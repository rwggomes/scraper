import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';
import fs from 'fs';

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

  console.log('Botão clicado');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Tabela carregada');

  // Extrair do iframe
  const rows = await frame.$$('#searchResults tr.oneresult');
  const extractedData = [];

  for (const row of rows) {
    const tdsHandles = await row.$$('td');
//Essa parte tá errada
    if (tdsHandles.length >= 7) {
      const name = await tdsHandles[0].evaluate(td => td.innerText.trim());
      const dob = await tdsHandles[5].evaluate(td => td.innerText.trim());
      const patientID = await tdsHandles[6].evaluate(td => td.innerText.trim());

      if (name && dob && patientID) {
        extractedData.push({ name, dob, patientID });
      }
    }
  }

  console.log('Dados extraídos:', extractedData);

  // Salva os dados
  fs.writeFile('./data/patients.json', JSON.stringify(extractedData, null, 2), (err) => {
    if (err) throw err;
    console.log('Arquivo salvo com sucesso!');
  });

  await browser.close();
})();
