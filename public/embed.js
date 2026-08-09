(function () {
  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var apiKey = scriptTag.getAttribute('data-key');
  if (!apiKey) {
    console.error('[chatbot embed] Brak atrybutu data-key na tagu <script>.');
    return;
  }

  var position = scriptTag.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var origin = new URL(scriptTag.src).origin;

  var isOpen = false;

  var button = document.createElement('button');
  button.setAttribute('type', 'button');
  // aria-expanded mówi czytnikowi ekranu, czy okno jest otwarte. Bez tego
  // użytkownik słyszy tylko "Otwórz czat" i nie wie, czy kliknięcie zadziałało.
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Otwórz czat');
  button.style.cssText = [
    'position:fixed',
    'bottom:20px',
    position + ':20px',
    'width:56px',
    'height:56px',
    'border-radius:50%',
    'background:#111827',
    'color:#fff',
    'border:none',
    'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
    'cursor:pointer',
    'z-index:2147483000',
    'font-size:24px',
  ].join(';');
  button.textContent = '💬';

  var iframe = document.createElement('iframe');
  // Ramka bez tytułu jest dla czytnika ekranu bezimienna — WCAG 4.1.2
  iframe.setAttribute('title', 'Okno czatu');
  iframe.src = origin + '/widget?key=' + encodeURIComponent(apiKey);
  iframe.style.cssText = [
    'position:fixed',
    'bottom:88px',
    position + ':20px',
    'width:360px',
    'height:520px',
    'max-width:calc(100vw - 40px)',
    'max-height:calc(100vh - 120px)',
    'border:none',
    'border-radius:12px',
    'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
    'z-index:2147483000',
    'display:none',
  ].join(';');

  function ustawStan(otwarte) {
    isOpen = otwarte;
    iframe.style.display = otwarte ? 'block' : 'none';
    button.setAttribute('aria-expanded', otwarte ? 'true' : 'false');
    button.setAttribute('aria-label', otwarte ? 'Zamknij czat' : 'Otwórz czat');
  }

  button.addEventListener('click', function () {
    ustawStan(!isOpen);
  });

  // Escape zamyka okno i oddaje ognisko przyciskowi — bez tego użytkownik
  // klawiatury zostaje uwięziony w ramce bez wyjścia.
  document.addEventListener('keydown', function (zdarzenie) {
    if (zdarzenie.key === 'Escape' && isOpen) {
      ustawStan(false);
      button.focus();
    }
  });

  function mount() {
    document.body.appendChild(iframe);
    document.body.appendChild(button);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
