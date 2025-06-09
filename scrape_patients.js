import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';
import fs from 'fs';

// Base URL of the OpenEMR demo environment
const baseUrl = 'https://demo.openemr.io/openemr';

(async () => {
  // Launch browser in non-headless mode with a maximized window
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.goto(baseUrl);

  // Wait for the login form and fill in credentials
  await page.waitForSelector('#authUser');
  await page.type('#authUser', 'admin', { delay: 10 });
  await page.type('#clearPass', 'pass', { delay: 10 });
  await page.click('#login-button');

  // Wait for navigation to dashboard after login
  await page.waitForNavigation();

  // Open the main menu
  await page.waitForSelector('div.oe-dropdown-toggle');
  await page.click('div.oe-dropdown-toggle');

  // Wait for the menu entries to appear and store the list
  await page.waitForSelector('.menuEntries li');
  const items = await page.$$('.menuEntries li');

  // Click the second item in the menu (likely "Patient/Client")
  await items[1].click();

  // Look through menu items to find and click "New/Search"
  for (const item of items) {
    const text = await page.evaluate(el => el.textContent.trim(), item);
    if (text === 'New/Search') {
      await item.click();
      break;
    }
  }

  // Switch to the iframe containing the patient search interface
  await page.waitForSelector('iframe[name="pat"]');
  const frameHandle = await page.$('iframe[name="pat"]');
  const frame = await frameHandle.contentFrame();

  // Wait for the search button, scroll to it, then click
  await frame.waitForSelector('#search');
  await frame.evaluate(() => {
    const btn = document.querySelector('#search');
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Small delay to allow smooth scrolling before clicking
  await new Promise(resolve => setTimeout(resolve, 1000));
  await frame.click('#search');

  // Log status and take a screenshot for debugging purposes
  console.log('Botão clicado, aguardando tabela...');
  await page.screenshot({ path: './data/debug_fallback.png', fullPage: true });

  // Wait for the modal iframe that displays the search results to load
  await page.waitForSelector('iframe#modalframe', { visible: true });

  // Step 3: Switch context to the modal iframe
  const modalFrameHandle = await page.$('iframe#modalframe');
  const modalFrame = await modalFrameHandle.contentFrame();

  // Step 4: Wait for the first row of patient search results
  await modalFrame.waitForSelector('tr.oneresult', { timeout: 5000 });
  console.log('✅ Patient search results found.');

  // Step 5: Get all rows with class 'oneresult' from the search result table
  const rows = await modalFrame.$$('#searchResults tr.oneresult');
  console.log(`Encontradas ${rows.length} linhas na tabela.`);

  const extractedData = [];

  for (const row of rows) {
    const tdsHandles = await row.$$('td');
    
    // Ensure row has at least 7 columns before extracting
    if (tdsHandles.length >= 7) {
      // Extract patient name, date of birth, and ID from relevant columns
      const name = await tdsHandles[0].evaluate(td => td.innerText.trim());
      const dob = await tdsHandles[5].evaluate(td => td.innerText.trim());
      const patientID = await tdsHandles[6].evaluate(td => td.innerText.trim());

      // Only add complete records
      if (name && dob && patientID) {
        extractedData.push({ name, dob, patientID });
      }
    }
  }

  console.log('Dados extraídos:', extractedData);

  // Save the extracted data to a JSON file
  fs.writeFile('./data/patients.json', JSON.stringify(extractedData, null, 2), (err) => {
    if (err) throw err;
    console.log('Arquivo salvo com sucesso!');
  });

  // Close the browser session
  await browser.close();
})();
