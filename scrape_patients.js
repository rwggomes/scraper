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
  await page.type('#authUser', 'admin', { delay: 10 });
  await page.type('#clearPass', 'pass', { delay: 10 });
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
  await new Promise(resolve => setTimeout(resolve, 1000));
  await frame.click('#search');

  console.log('Botão clicado, aguardando tabela...');
  await page.screenshot({ path: './data/debug_fallback.png', fullPage: true });
  // Extrair do iframe
  await page.waitForSelector('iframe#modalframe', { visible: true });

  // Step 3: Switch context to the new iframe
  const modalFrameHandle = await page.$('iframe#modalframe');
  const modalFrame = await modalFrameHandle.contentFrame();

  // Step 4: Wait for the results inside that modal iframe
  await modalFrame.waitForSelector('tr.oneresult', { timeout: 5000 });

  console.log('✅ Patient search results found.');
  
  // Step 5: Extract data from the table rows
  const rows = await modalFrame.$$('#searchResults tr.oneresult'); 
  
  console.log(Encontradas ${rows.length} linhas na tabela.);
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
