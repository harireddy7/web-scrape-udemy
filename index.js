const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const writeToFile = async (data) => {
	fs.writeFileSync(path.join(__dirname, 'data', 'courses.json'), data, {
		encoding: 'utf-8',
	});
};

async function launchScrape() {
	const browser = await puppeteer.launch({
		headless: false,
		args: ['--start-maximized'],
		executablePath: executablePath(),
	});
	const page = await browser.newPage();
	await page.goto('https://www.udemy.com/topic/front-end-web-development/', {
		waitUntil: 'networkidle0',
	});

	await sleep(1000);
	await page.setViewport({
		width: 1400,
		height: 800,
		deviceScaleFactor: 1,
	});
	await sleep(1000);

	const courses = await page.evaluate(() => {
		const childNodes = [...document.querySelector('[class^="course-list--container"]').childNodes];
		const _courses = childNodes.reduce((list, node) => {
			const c = {
				title: node.getElementsByTagName('a')[0]?.innerHTML.split('<div')[0],
				description: node?.getElementsByTagName('p')[0]?.innerHTML,
				instructor: node.querySelectorAll('[class^="course-card--instructor"]')[0]?.innerText,
				rating: node.querySelectorAll('[data-purpose="rating-number"]')[0]?.innerText,
				reviews: node.querySelectorAll('[class*="course-card--reviews-text"]')[0]?.innerText,
				watchTime: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[0]
					?.innerText,
				lectures: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[1]
					?.innerText,
				level: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[2]?.innerText,
				price: node.querySelectorAll('[data-purpose="course-price-text"] > span > span')[0]
					?.innerText,
			};
			if (Object.keys(c).every((k) => c[k] !== undefined)) {
				list.push(c);
			}
			return list;
		}, []);
		return _courses;
	});

	await writeToFile(JSON.stringify(courses));
	// await page.screenshot({ path: 'udemy.png', fullPage: true });

	await browser.close();
}

launchScrape();
