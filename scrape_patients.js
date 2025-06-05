import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';

const baseUrl = 'https://demo.openemr.io/openemr';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page.waitForSelector('#authUser');
  await page.type('#authUser', 'admin', { delay: 100 });
  await page.type('#clearPass', 'pass', { delay: 100 });
  await page.click('#login-button');

  await page.waitForNavigation();
  await page.waitForSelector('div.oe-dropdown-toggle');
  await page.click('div.oe-dropdown-toggle');

  await page.waitForSelector('.menuEntries li');
  const items = await page.$$('.menuEntries li');

  await items[1].click();
  for (const item of items) {
    const text = await page.evaluate(el => el.textContent.trim(), item);
    if (text === 'New/Search') {
      await item.click();
      break;
    }
  }

  await page.waitForSelector('iframe[name="pat"]');
  const frameHandle = await page.$('iframe[name="pat"]');
  const frame = await frameHandle.contentFrame();

  await frame.waitForSelector('#search');
  await frame.evaluate(() => {
    const btn = document.querySelector('#search');
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  await frame.click('#search');
  console.log('Botão clicado!');

  await frame.waitForFunction(() => {
    const firstRow = document.querySelector('tr.oneresult');
    return firstRow && firstRow.querySelectorAll('td').length > 6;
  }, { timeout: 10000 });

  await frame.evaluate(() => {
    const table = document.querySelector('table');
    if (table) {
      table.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  const patients = await frame.$$eval('tr.oneresult', (rows) => {
    return rows
      .map(row => {
        const tds = row.querySelectorAll('td');
        if (tds.length >= 7) {
          return {
            name: tds[0].innerText.trim(),
            dob: tds[4].innerText.trim(),
            patientId: tds[6].innerText.trim(),
          };
        }
        return null;
      })
      .filter(Boolean);
  });

  console.log('Dados extraídos:', patients);

  // Salva em JSON
  await writeFile('./data/patients.json', JSON.stringify(patients, null, 2));
  console.log('Dados salvos em ./data/patients.json');

  await browser.close();
})();
