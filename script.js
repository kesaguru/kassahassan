const pohjakassaInput = document.getElementById('pohjakassa');
const currencyInputsContainer = document.querySelector('.currency-inputs');
const yhteissummaSpan = document.getElementById('yhteissumma');
// HUOM: Ei enää globaalina const loomikseenSpan
const laskeButton = document.getElementById('laske');

// Valuuttadata ilman rullia
const currencyData = [
  { name: '500€ seteli', value: 500 },
  { name: '200€ seteli', value: 200 },
  { name: '100€ seteli', value: 100 },
  { name: '50€ seteli', value: 50 },
  { name: '20€ seteli', value: 20 },
  { name: '10€ seteli', value: 10 },
  { name: '5€ seteli', value: 5 },
  { name: '2€ kolikko', value: 2 },
  { name: '1€ kolikko', value: 1 },
  { name: '50 sentin kolikko', value: 0.5 },
  { name: '20 sentin kolikko', value: 0.2 },
  { name: '10 sentin kolikko', value: 0.1 },
  { name: '5 sentin kolikko', value: 0.05 },
];

// Rullat omana taulukkonaan
const rullatData = [
  { name: '2€ rullat (50€)', value: 50 },
  { name: '1€ rullat (25€)', value: 25 },
  { name: '50snt rullat (20€)', value: 20 },
  { name: '20snt rullat (8€)', value: 8 },
  { name: '10snt rullat (4€)', value: 4 },
  { name: '5snt rullat (2.5€)', value: 2.5 }
];

// Järjestä valuuttadata arvon mukaan laskevasti
currencyData.sort((a, b) => b.value - a.value);
rullatData.sort((a, b) => b.value - a.value);

// Luo syöttökentät setelien ja kolikoiden määrille
currencyData.forEach(currency => {
  createCurrencyInput(currency);
});

// Luo syöttökentät rullien määrille
rullatData.forEach(rulla => {
  createCurrencyInput(rulla);
});

// Pohjakassa-painikkeiden tapahtumankäsittelijät
const pohjakassa500Button = document.getElementById('pohjakassa500');
const pohjakassa300Button = document.getElementById('pohjakassa300');

pohjakassa500Button.addEventListener('click', () => {
  pohjakassaInput.value = 500;
});

pohjakassa300Button.addEventListener('click', () => {
  pohjakassaInput.value = 300;
});

// Lisää-painikkeen tapahtumankäsittelijä
const naytaLahjakortitButton = document.getElementById('naytaLahjakortit');
const lahjakortitOsio = document.getElementById('lahjakortit-osio');

naytaLahjakortitButton.addEventListener('click', () => {
  if (lahjakortitOsio.style.display === 'none') {
    lahjakortitOsio.style.display = 'block';
    naytaLahjakortitButton.textContent = 'Piilota';
  } else {
    lahjakortitOsio.style.display = 'none';
    naytaLahjakortitButton.textContent = 'Lisää';
  }
});

// Kopioi-painikkeen tapahtumankäsittelijä
const kopioiYhteissummaButton = document.getElementById('kopioiYhteissumma');

kopioiYhteissummaButton.addEventListener('click', () => {
  const yhteissumma = yhteissummaSpan.textContent.replace(' €', '');
  navigator.clipboard.writeText(yhteissumma)
    .then(() => {
      console.log('Yhteissumma kopioitu leikepöydälle:', yhteissumma);
    })
    .catch(err => {
      console.error('Kopiointi epäonnistui:', err);
    });
});

function createCurrencyInput(currency) {
  const currencyInput = `
        <div class="currency-input">
            <label for="${currency.name}">${currency.name}:</label>
            <input type="number" id="${currency.name}" value="0" data-value="${currency.value}" min="0"> 
            <span>0 €</span>
        </div>
    `;
  currencyInputsContainer.innerHTML += currencyInput;
}

// Päivitä summat syöttökenttien muuttuessa
currencyInputsContainer.addEventListener('input', () => {
  updateSums();
});

// Laske yhteissumma ja "Loomikseen menee" -summa
laskeButton.addEventListener('click', () => {
  calculateTotal();
});

function updateSums() {
  const currencyInputs = document.querySelectorAll('.currency-input');
  currencyInputs.forEach(input => {
    let amount = parseInt(input.querySelector('input').value, 10);

    // Tarkista negatiiviset arvot
    if (isNaN(amount) || amount < 0) {
      amount = 0;
      input.querySelector('input').value = 0;
    }

    const value = parseFloat(input.querySelector('input').dataset.value);
    const sum = amount * value;
    input.querySelector('span').textContent = `${sum.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  });
}

function calculateTotal() {
  let total = 0;
  const currencyInputs = document.querySelectorAll('.currency-input');
  currencyInputs.forEach(input => {
    const amount = parseInt(input.querySelector('input').value, 10) || 0;
    const value = parseFloat(input.querySelector('input').dataset.value);
    total += amount * value;
  });

  let pohjakassa = parseFloat(
    (pohjakassaInput.value || '0').toString().replace(',', '.')
  );

  // Tarkista negatiivinen pohjakassa
  if (isNaN(pohjakassa) || pohjakassa < 0) {
    pohjakassa = 0;
    pohjakassaInput.value = 0;
  }

  const loomikseen = total - pohjakassa;

  yhteissummaSpan.textContent = `${total.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // Haetaan aina uusin span, ei käytetä vanhaa viitettä
  const loomikseenSpan = document.getElementById('loomikseen');
  if (loomikseenSpan) {
    loomikseenSpan.textContent = `${loomikseen.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  calculateChange();
}

function calculateChange() {
  // Luetaan loomikseen-summa spanista ja parsitaan numeroksi
  const loomikseenText = document.getElementById('loomikseen').textContent;
  let loomikseen = parseFloat(
    loomikseenText.replace(/[^0-9,]/g, '').replace(',', '.')
  );

  // Pyöristetään sentin tarkkuuteen, jotta liukulukubugit poistuvat
  loomikseen = Math.round((loomikseen || 0) * 100) / 100;

  let remainingAmount = loomikseen;
  const change = {};

  for (const currency of currencyData) {
    const inputElement = document.getElementById(currency.name);
    const amount = parseInt(inputElement.value, 10) || 0;

    // Pidetään remainingAmount aina sentin tarkkuudella
    remainingAmount = Math.round(remainingAmount * 100) / 100;

    // Pieni "turvamarginaali" estää 0.8999999 / 0.1 → 8 -tilanteen
    const maxAmount = Math.min(
      amount,
      Math.floor((remainingAmount + 1e-9) / currency.value)
    );

    if (maxAmount > 0) {
      change[currency.name] = maxAmount;
      remainingAmount -= maxAmount * currency.value;
    }
  }

  let changeText = "";
  for (const currencyName in change) {
    if (change[currencyName] > 0) {
      changeText += `${currencyName}: ${change[currencyName]} kpl<br>`;
    }
  }

  const loomikseenDiv = document.getElementById('loomikseen').parentElement;
  loomikseenDiv.innerHTML = `
    <p>Loomikseen menee:</p>
    <span id="loomikseen">
      ${loomikseen.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
    </span>
    <p>${changeText}</p>
  `;
}
