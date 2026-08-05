// Konfiguration der Rastergröße (muss mit CSS background-size übereinstimmen)
const GRID_SIZE = 20;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

const canvas = document.getElementById('canvas') as HTMLDivElement;
const draggableItems = document.querySelectorAll<HTMLDivElement>('.draggable-item');

let draggedType: string | null = null;

// 1. Drag-Events für die Seitenleisten-Elemente
draggableItems.forEach((item) => {
  item.addEventListener('dragstart', (e: DragEvent) => {
    draggedType = item.getAttribute('data-type');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
    }
  });
});

// 2. Canvas Drag-Over (erforderlich, um Drops zu erlauben)
canvas.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
});

// 3. Drop-Event auf dem Canvas
canvas.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();

  if (!draggedType) return;

  // Relative Koordinaten im Canvas berechnen
  const canvasRect = canvas.getBoundingClientRect();
  const rawX = e.clientX - canvasRect.left;
  const rawY = e.clientY - canvasRect.top;

  // Koordinaten an das Grid anpassen
  const snappedX = snapToGrid(rawX, GRID_SIZE);
  const snappedY = snapToGrid(rawY, GRID_SIZE);

  // Neues Element im Canvas erzeugen
  createElementOnCanvas(draggedType, snappedX, snappedY);

  draggedType = null;
});

// Funktion zum Platzieren des Elements
function createElementOnCanvas(type: string, x: number, y: number): void {
  const element = document.createElement('div');
  element.classList.add('placed-element');
  element.innerText = type === 'card' ? 'Neue Karte' : 'Neuer Button';

  element.style.left = `${x}px`;
  element.style.top = `${y}px`;

  // Das Element innerhalb des Canvas verschiebbar machen
  makeElementDraggableOnCanvas(element);

  canvas.appendChild(element);
}

// 4. Nachträgliches Verschieben von platzierten Elementen auf dem Canvas
function makeElementDraggableOnCanvas(element: HTMLDivElement): void {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    
    // Offset berechnen, damit das Element nicht an der Ecke "snappt"
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    element.style.zIndex = '1000'; // Nach vorne holen beim Ziehen
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const canvasRect = canvas.getBoundingClientRect();
    const rawX = e.clientX - canvasRect.left - offsetX;
    const rawY = e.clientY - canvasRect.top - offsetY;

    const snappedX = snapToGrid(rawX, GRID_SIZE);
    const snappedY = snapToGrid(rawY, GRID_SIZE);

    element.style.left = `${snappedX}px`;
    element.style.top = `${snappedY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.zIndex = '1';
    }
  });
}


//Löschen

let selectedElement: HTMLElement | null = null;

// Auswählen eines Elements
canvas.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const element = target.closest('.placed-element') as HTMLElement | null;

  // Vorherige Auswahl aufheben
  if (selectedElement) {
    selectedElement.style.outline = 'none';
  }

  if (element) {
    selectedElement = element;
    selectedElement.style.outline = '2px solid #ef4444'; // Roter Rahmen zur Markierung
  } else {
    selectedElement = null; // Klick ins Leere hebt Auswahl auf
  }
});

// Tastatur-Event zum Löschen abfangen
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
    selectedElement.remove();
    selectedElement = null;
  }
});