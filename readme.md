


# OpenEMR Patient Scraper

This script automates the login and extraction of patient data from the OpenEMR demo system using [Puppeteer](https://pptr.dev/), a Node.js library for browser automation.

---

## Prerequisites

- Node.js v16 or higher


---

## Installation

Clone this repository (or copy the required files), open a terminal in the project directory, and run:

```bash
npm install puppeteer
````

---

## How to Run

Execute the script with:

```bash
node scrape_patients.js
```

Note: The script launches a visible browser window (`headless: false`) so you can observe the automation in real time.

---

## Expected Output

The script performs the following steps:

1. Opens the OpenEMR demo site: `https://demo.openemr.io/openemr`
2. Logs in using the default credentials:

   * Username: `admin`
   * Password: `pass`
3. Navigates to the patient search section.
4. Clicks the "Search" button.
5. Waits for the results to load.
6. Extracts the following data for each patient:

   * Full name
   * Date of birth (DOB)
   * Patient ID
   * Phone Number
   * Medications

7. Saves the data as a JSON file at:

```
./data/patients.json
```

---

### Example Output

```json
[
  {
    "name": "Belford, Phil",
    "dob": "1972-02-09",
    "patientID": "1"
  },
  {
    "name": "Castillo, Jared",
    "dob": "1993-10-08",
    "patientID": "16"
  }
]
```

---

## Recommended Project Structure

```
.
├── scrape_patients.js
├── data
│   └── patients.json
└── README.md
```

---

## Notes

* The OpenEMR demo environment is public and may reset or become unstable. Ensure data is available before running the script.
* If the interface changes (e.g., element IDs or classes), you may need to update the script's selectors.
* To run the script in headless mode (no visible browser window), change `headless: false` to `true` in the `puppeteer.launch()` options.

