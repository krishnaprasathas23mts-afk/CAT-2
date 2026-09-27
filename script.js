'use strict';

/* ==========================================================================
   Aurora Calculator — Application Logic
   ========================================================================== */

const CalculatorEngine = (() => {
  let currentValue = '0';
  let previousValue = null;
  let pendingOperator = null;
  let overwrite = true;

  const formatNumber = (numStr) => {
    if (numStr === 'Error') return numStr;
    const [intPart, decPart] = numStr.split('.');
    const formattedInt = new Intl.NumberFormat('en-US').format(Number(intPart));
    return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  };

  const inputDigit = (digit) => {
    if (overwrite) {
      currentValue = digit === '.' ? '0.' : digit;
      overwrite = false;
    } else {
      if (digit === '.' && currentValue.includes('.')) return;
      if (currentValue.replace('-', '').replace('.', '').length >= 15) return;
      currentValue += digit;
    }
  };

  const clearAll = () => {
    currentValue = '0';
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
  };

  const deleteLast = () => {
    if (overwrite) return;
    currentValue = currentValue.slice(0, -1);
    if (currentValue === '' || currentValue === '-') currentValue = '0';
    if (currentValue === '0') overwrite = true;
  };

  const toggleSign = () => {
    if (currentValue === '0') return;
    currentValue = currentValue.startsWith('-') ? currentValue.slice(1) : '-' + currentValue;
  };

  const toPercent = () => {
    currentValue = String(parseFloat(currentValue) / 100);
    overwrite = true;
  };

  const compute = (a, b, op) => {
    const x = parseFloat(a);
    const y = parseFloat(b);
    switch (op) {
      case '+': return x + y;
      case '-': return x - y;
      case '*': return x * y;
      case '/':
        if (y === 0) throw new Error('DIV0');
        return x / y;
      default: return y;
    }
  };

  const setOperator = (op) => {
    if (pendingOperator && !overwrite) {
      try {
        const result = compute(previousValue, currentValue, pendingOperator);
        currentValue = trimResult(result);
      } catch (e) {
        clearAll();
        currentValue = 'Error';
        pendingOperator = null;
        previousValue = null;
        return;
      }
    }
    previousValue = currentValue;
    pendingOperator = op;
    overwrite = true;
  };

  const trimResult = (num) => {
    if (!isFinite(num)) throw new Error('DIV0');
    let s = num.toString();
    if (s.includes('e')) {
      s = num.toPrecision(10).replace(/\.?0+$/, '');
    } else if (s.includes('.') && s.split('.')[1].length > 8) {
      s = num.toFixed(8).replace(/\.?0+$/, '');
    }
    return s;
  };

  const equals = () => {
    if (pendingOperator === null || previousValue === null) return null;
    let result;
    try {
      result = compute(previousValue, currentValue, pendingOperator);
    } catch (e) {
      const expr = `${formatNumber(previousValue)} ${symbolFor(pendingOperator)} ${formatNumber(currentValue)}`;
      clearAll();
      currentValue = 'Error';
      overwrite = true;
      return { expr, result: 'Error', error: true };
    }
    const expr = `${formatNumber(previousValue)} ${symbolFor(pendingOperator)} ${formatNumber(currentValue)}`;
    const resultStr = trimResult(result);
    currentValue = resultStr;
    previousValue = null;
    pendingOperator = null;
    overwrite = true;
    return { expr, result: formatNumber(resultStr), error: false };
  };

  const symbolFor = (op) => ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op);

  const getDisplay = () => formatNumber(currentValue);
  const getExpression = () => {
    if (pendingOperator && previousValue !== null) {
      return `${formatNumber(previousValue)} ${symbolFor(pendingOperator)}`;
    }
    return '';
  };

  return {
    inputDigit, clearAll, deleteLast, toggleSign, toPercent,
    setOperator, equals, getDisplay, getExpression,
  };
})();

/* ============================== History Store ============================== */

const HistoryStore = (() => {
  const KEY = 'aurora_calc_history';

  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  };

  const save = (items) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch { /* storage unavailable */ }
  };

  const add = (expr, result) => {
    const items = load();
    items.unshift({ expr, result, id: Date.now() });
    save(items.slice(0, 50));
  };

  const remove = (id) => {
    save(load().filter((item) => item.id !== id));
  };

  const clear = () => save([]);

  return { load, add, remove, clear };
})();

/* ============================== UI Controller ============================== */

const UI = (() => {
  const els = {
    expression: document.getElementById('expression'),
    result: document.getElementById('result'),
    keys: document.getElementById('keys'),
    historyToggle: document.getElementById('historyToggle'),
    historyPanel: document.getElementById('historyPanel'),
    historyList: document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory'),
    themeToggle: document.getElementById('themeToggle'),
    toast: document.getElementById('toast'),
    calculator: document.getElementById('calculator'),
    cursorGlow: document.getElementById('cursorGlow'),
    particles: document.getElementById('particles'),
  };

  let toastTimer = null;

  const showToast = (msg) => {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  };

  const renderDisplay = () => {
    els.expression.textContent = CalculatorEngine.getExpression();
    els.result.textContent = CalculatorEngine.getDisplay();
    els.result.classList.remove('error');
    pulseResult();
  };

  const pulseResult = () => {
    els.result.classList.remove('pulse');
    void els.result.offsetWidth;
    els.result.classList.add('pulse');
  };

  const showError = () => {
    els.result.textContent = 'Error';
    els.result.classList.add('error');
    showToast('Cannot divide by zero');
  };

  const renderHistory = () => {
    const items = HistoryStore.load();
    els.historyList.innerHTML = '';
    if (items.length === 0) {
      els.historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
      return;
    }
    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        <div class="history-expr">${item.expr}</div>
        <div class="history-result">${item.result}</div>
      `;
      el.addEventListener('click', () => {
        CalculatorEngine.clearAll();
        item.result.replace(/,/g, '').split('').forEach((ch) => {
          if (/[0-9.]/.test(ch)) CalculatorEngine.inputDigit(ch);
        });
        renderDisplay();
      });
      els.historyList.appendChild(el);
    });
  };

  const highlightOperator = (op) => {
    document.querySelectorAll('.key.op').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.op === op);
    });
  };

  const rippleAt = (btn, x, y) => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--rx', `${x - rect.left}px`);
    btn.style.setProperty('--ry', `${y - rect.top}px`);
    btn.style.setProperty('--mx', `${((x - rect.left) / rect.width) * 100}%`);
    btn.style.setProperty('--my', `${((y - rect.top) / rect.height) * 100}%`);
    btn.classList.remove('ripple');
    void btn.offsetWidth;
    btn.classList.add('ripple');
  };

  const initParticles = () => {
    const count = 26;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const left = Math.random() * 100;
      const delay = Math.random() * 14;
      const duration = 10 + Math.random() * 10;
      p.style.left = `${left}%`;
      p.style.bottom = `-10px`;
      p.style.animationDelay = `${delay}s`;
      p.style.animationDuration = `${duration}s`;
      els.particles.appendChild(p);
    }
  };

  const initCursorGlow = () => {
    document.addEventListener('mousemove', (e) => {
      els.cursorGlow.style.opacity = '1';
      els.cursorGlow.style.left = `${e.clientX}px`;
      els.cursorGlow.style.top = `${e.clientY}px`;
    });
    document.addEventListener('mouseleave', () => {
      els.cursorGlow.style.opacity = '0';
    });
  };

  const initTheme = () => {
    let saved = null;
    try { saved = localStorage.getItem('aurora_calc_theme'); } catch { /* noop */ }
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');

    els.themeToggle.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('aurora_calc_theme', 'dark'); } catch { /* noop */ }
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        try { localStorage.setItem('aurora_calc_theme', 'light'); } catch { /* noop */ }
      }
    });
  };

  const initHistoryPanel = () => {
    els.historyToggle.addEventListener('click', () => {
      els.historyPanel.classList.toggle('open');
      if (els.historyPanel.classList.contains('open')) renderHistory();
    });
    els.clearHistory.addEventListener('click', () => {
      HistoryStore.clear();
      renderHistory();
      showToast('History cleared');
    });
  };

  return {
    els, renderDisplay, showError, renderHistory, highlightOperator,
    rippleAt, initParticles, initCursorGlow, initTheme, initHistoryPanel, showToast,
  };
})();

/* ============================== Event Wiring ============================== */

function handleKeyAction(btn, x, y) {
  UI.rippleAt(btn, x, y);

  const { num, op, action } = btn.dataset;

  if (num !== undefined) {
    CalculatorEngine.inputDigit(num);
    UI.highlightOperator(null);
    UI.renderDisplay();
    return;
  }

  if (op !== undefined) {
    CalculatorEngine.setOperator(op);
    UI.highlightOperator(op);
    UI.renderDisplay();
    if (UI.els.result.textContent === 'Error') UI.showError();
    return;
  }

  switch (action) {
    case 'clear':
      CalculatorEngine.clearAll();
      UI.highlightOperator(null);
      UI.renderDisplay();
      break;
    case 'delete':
      CalculatorEngine.deleteLast();
      UI.renderDisplay();
      break;
    case 'sign':
      CalculatorEngine.toggleSign();
      UI.renderDisplay();
      break;
    case 'percent':
      CalculatorEngine.toPercent();
      UI.renderDisplay();
      break;
    case 'decimal':
      CalculatorEngine.inputDigit('.');
      UI.renderDisplay();
      break;
    case 'equals': {
      const outcome = CalculatorEngine.equals();
      UI.highlightOperator(null);
      if (!outcome) return;
      if (outcome.error) {
        UI.showError();
      } else {
        UI.els.expression.textContent = outcome.expr;
        UI.els.result.textContent = outcome.result;
        UI.els.result.classList.remove('pulse');
        void UI.els.result.offsetWidth;
        UI.els.result.classList.add('pulse');
        HistoryStore.add(outcome.expr, outcome.result);
      }
      break;
    }
    default:
      break;
  }
}

function initKeyClicks() {
  document.querySelectorAll('.key').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      handleKeyAction(btn, e.clientX || 0, e.clientY || 0);
    });
  });
}

function initKeyboardSupport() {
  const opMap = { '+': '+', '-': '-', '*': '*', '/': '/' };

  document.addEventListener('keydown', (e) => {
    const { key } = e;

    if (/^[0-9]$/.test(key)) {
      const btn = document.querySelector(`.key[data-num="${key}"]`);
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (key === '.') {
      const btn = document.querySelector('.key[data-action="decimal"]');
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (opMap[key]) {
      const btn = document.querySelector(`.key[data-op="${opMap[key]}"]`);
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (key === 'Enter' || key === '=') {
      e.preventDefault();
      const btn = document.querySelector('.key[data-action="equals"]');
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (key === 'Backspace') {
      const btn = document.querySelector('.key[data-action="delete"]');
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (key === 'Escape' || key.toLowerCase() === 'c') {
      const btn = document.querySelector('.key[data-action="clear"]');
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    if (key === '%') {
      const btn = document.querySelector('.key[data-action="percent"]');
      if (btn) handleKeyAction(btn, window.innerWidth / 2, window.innerHeight / 2);
    }
  });
}

/* ============================== Init ============================== */

document.addEventListener('DOMContentLoaded', () => {
  UI.renderDisplay();
  UI.initParticles();
  UI.initCursorGlow();
  UI.initTheme();
  UI.initHistoryPanel();
  initKeyClicks();
  initKeyboardSupport();
});