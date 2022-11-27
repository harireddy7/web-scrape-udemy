const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');

const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const CATEGORIES = require('./categories');

const writeToFile = async (data) => {
	const filePath = path.join(__dirname, 'data', 'compiledCourses.json');
	const fileData = fs.readFileSync(filePath, { encoding: 'utf-8' });
	
	const content = fileData ? [...JSON.parse(fileData), ...data] : [...data];

	fs.writeFileSync(filePath, JSON.stringify(content), {
		encoding: 'utf-8',
	});
};

(async () => {
	const cluster = await Cluster.launch({
		concurrency: Cluster.CONCURRENCY_PAGE,
		maxConcurrency: 100,
		monitor: true,
		timeout: 120000,
		puppeteerOptions: {
			headless: false,
			defaultViewport: false,
		},
	});

	cluster.on('taskerror', (err, data) => {
		console.log(`Error crawling ${JSON.stringify(data)}: ${err.message}`);
	});

	await cluster.task(async ({ page, data }) => {
		await page.setViewport({
			width: 1400,
			height: 800,
			deviceScaleFactor: 1,
		});
		await page.goto(`https://www.udemy.com${data.link}`, {
			waitUntil: 'networkidle0',
			timeout: 0,
		});

		await page.waitForSelector('[class^="course-list--container"]');

		const courses = await page.evaluate((data) => {
			const childNodes = [
				...document.querySelector('[class^="course-list--container"]').childNodes,
			];
			// alert(childNodes.length);
			const _courses = childNodes.reduce((list, node) => {
				const c = {
					title: node.getElementsByTagName('a')[0]?.innerHTML.split('<div')[0],
					category: data.label,
					description: node?.getElementsByTagName('p')[0]?.innerHTML,
					instructor: node.querySelectorAll('[class^="course-card--instructor"]')[0]?.innerText,
					rating: node.querySelectorAll('[data-purpose="rating-number"]')[0]?.innerText,
					reviews: node.querySelectorAll('[class*="course-card--reviews-text"]')[0]?.innerText,
					watchTime: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[0]
						?.innerText,
					lectures: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[1]
						?.innerText,
					level: node.querySelectorAll('[class*="course-card--course-meta-info"] span')[2]
						?.innerText,
					price: node.querySelectorAll('[data-purpose="course-price-text"] > span > span')[0]
						?.innerText,
				};
				if (c.title?.includes('<span>') || !c.description || !c.instructor || !c.lectures) {
					return list;
				}
				list.push(c);
				return list;
			}, []);

			return _courses.slice(0, data.items);
		}, data);

		await writeToFile(courses);
	});

	for (const cat of CATEGORIES) {
		await cluster.queue(cat);
	}

	await cluster.idle();
	await cluster.close();
})();
