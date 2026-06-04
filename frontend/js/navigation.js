// navigation.js - Gamepad D-pad focus navigation

const contexts = {};
let currentFocusedElement = null;

export function registerFocusables(context, elements) {
  contexts[context] = elements;
  // Automatically focus first item if none focused
  if (!currentFocusedElement && elements.length > 0) {
    setFocus(elements[0]);
  }
}

export function clearFocusables(context) {
  if (context === 'global') {
    for (let key in contexts) delete contexts[key];
    if (currentFocusedElement) {
      currentFocusedElement.removeAttribute('data-focused');
      currentFocusedElement = null;
    }
  } else {
    delete contexts[context];
  }
}

function setFocus(element) {
  if (currentFocusedElement) {
    currentFocusedElement.removeAttribute('data-focused');
  }
  currentFocusedElement = element;
  if (currentFocusedElement) {
    currentFocusedElement.setAttribute('data-focused', 'true');
    // Scroll into view if needed
    currentFocusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function moveFocus(direction) { // 'up', 'down', 'left', 'right'
  const allFocusables = Object.values(contexts).flat().filter(el => el && el.offsetParent !== null);
  if (allFocusables.length === 0) return;
  
  if (!currentFocusedElement || !allFocusables.includes(currentFocusedElement)) {
    setFocus(allFocusables[0]);
    return;
  }
  
  const currentRect = currentFocusedElement.getBoundingClientRect();
  let bestNext = null;
  let bestDistance = Infinity;
  
  allFocusables.forEach(el => {
    if (el === currentFocusedElement) return;
    const rect = el.getBoundingClientRect();
    
    let isCandidate = false;
    let distance = 0;
    
    if (direction === 'up' && rect.bottom <= currentRect.top) {
      isCandidate = true;
      distance = Math.pow(rect.x - currentRect.x, 2) + Math.pow(rect.bottom - currentRect.top, 2);
    } else if (direction === 'down' && rect.top >= currentRect.bottom) {
      isCandidate = true;
      distance = Math.pow(rect.x - currentRect.x, 2) + Math.pow(rect.top - currentRect.bottom, 2);
    } else if (direction === 'left' && rect.right <= currentRect.left) {
      isCandidate = true;
      distance = Math.pow(rect.right - currentRect.left, 2) + Math.pow(rect.y - currentRect.y, 2);
    } else if (direction === 'right' && rect.left >= currentRect.right) {
      isCandidate = true;
      distance = Math.pow(rect.left - currentRect.right, 2) + Math.pow(rect.y - currentRect.y, 2);
    }
    
    if (isCandidate && distance < bestDistance) {
      bestDistance = distance;
      bestNext = el;
    }
  });
  
  if (bestNext) {
    setFocus(bestNext);
  }
}

export function selectFocused() {
  if (currentFocusedElement && typeof currentFocusedElement.click === 'function') {
    currentFocusedElement.click();
  }
}

// Keyboard fallback for testing without gamepad
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus('up'); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus('down'); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus('left'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus('right'); }
  else if (e.key === 'Enter') { e.preventDefault(); selectFocused(); }
});
