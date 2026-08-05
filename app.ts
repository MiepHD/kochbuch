const GRID_SIZE = 20;

const viewport = document.getElementById('viewport') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLDivElement;
const draggableItems = document.querySelectorAll<HTMLDivElement>('.draggable-item');

let scale = 1;
let panX = 0;
let panY = 0;

let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let draggedType: string | null = null;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function updateTransform() {
  // 1. Inhalt verschieben und skalieren
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

  // 2. Raster-Hintergrund dynamisch an Pan & Zoom anpassen
  const currentGridSize = GRID_SIZE * scale;
  
  // background-size skaliert mit dem Zoom
  viewport.style.backgroundSize = `${currentGridSize}px ${currentGridSize}px`;
  
  // background-position verschiebt das Muster synchron zum Pan
  viewport.style.backgroundPosition = `${panX}px ${panY}px`;
}

// 1. Pan-Funktionalität (Canvas verschieben per Drag auf freie Fläche)
viewport.addEventListener('mousedown', (e: MouseEvent) => {
  // e.button === 2 bedeutet rechte Maustaste
  if (e.button !== 2) return;

  isPanning = true;
  startPanX = e.clientX - panX;
  startPanY = e.clientY - panY;
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (!isPanning) return;
  panX = e.clientX - startPanX;
  panY = e.clientY - startPanY;
  updateTransform();
});

window.addEventListener('mouseup', () => {
  isPanning = false;
});

// 2. Zoom-Funktionalität (Mausrad rein-/rauszoomen zum Mauszeiger)
viewport.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();

  const zoomIntensity = 0.1;
  const oldScale = scale;

  if (e.deltaY < 0) {
    scale = Math.min(scale * (1 + zoomIntensity), 4); // Max Zoom 4x
  } else {
    scale = Math.max(scale * (1 - zoomIntensity), 0.2); // Min Zoom 0.2x
  }

  // Zoom auf die Mausposition zentrieren
  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  panX = mouseX - (mouseX - panX) * (scale / oldScale);
  panY = mouseY - (mouseY - panY) * (scale / oldScale);

  updateTransform();
}, { passive: false });

// 3. Drag & Drop aus der Seitenleiste
draggableItems.forEach((item) => {
  item.addEventListener('dragstart', (e: DragEvent) => {
    draggedType = item.getAttribute('data-type');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  });
});

viewport.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

viewport.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  if (!draggedType) return;

  const rect = viewport.getBoundingClientRect();
  const mouseXInViewport = e.clientX - rect.left;
  const mouseYInViewport = e.clientY - rect.top;

  // Koordinaten unter Berücksichtigung von Pan und Zoom umrechnen
  const contentX = (mouseXInViewport - panX) / scale;
  const contentY = (mouseYInViewport - panY) / scale;

  const snappedX = snapToGrid(contentX, GRID_SIZE);
  const snappedY = snapToGrid(contentY, GRID_SIZE);

  createElementOnCanvas(draggedType, snappedX, snappedY);
  draggedType = null;
});

// 4. Element erstellen
function createElementOnCanvas(type: string, x: number, y: number): void {
  const element = document.createElement('div');
  element.classList.add('placed-element');

  const label = document.createElement('span');
  label.innerText = type === 'card' ? 'Neue Karte' : 'Neuer Button';
  element.appendChild(label);

  const deleteBtn = document.createElement('button');
  deleteBtn.innerText = '×';
  deleteBtn.classList.add('delete-btn');
  deleteBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    element.remove();
  });
  element.appendChild(deleteBtn);

  element.style.left = `${x}px`;
  element.style.top = `${y}px`;

  makeElementDraggableOnCanvas(element);
  canvas.appendChild(element);
}

// 5. Bereits platzierte Elemente auf dem Canvas verschieben
function makeElementDraggableOnCanvas(element: HTMLDivElement): void {
  let isDraggingElement = false;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation(); // Verhindert gleichzeitiges Panning des Canvas
    isDraggingElement = true;

    const rect = viewport.getBoundingClientRect();
    const mouseXInViewport = e.clientX - rect.left;
    const mouseYInViewport = e.clientY - rect.top;

    const contentMouseX = (mouseXInViewport - panX) / scale;
    const contentMouseY = (mouseYInViewport - panY) / scale;

    offsetX = contentMouseX - element.offsetLeft;
    offsetY = contentMouseY - element.offsetTop;

    element.style.zIndex = '1000';
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDraggingElement) return;

    const rect = viewport.getBoundingClientRect();
    const mouseXInViewport = e.clientX - rect.left;
    const mouseYInViewport = e.clientY - rect.top;

    const contentX = (mouseXInViewport - panX) / scale - offsetX;
    const contentY = (mouseYInViewport - panY) / scale - offsetY;

    const snappedX = snapToGrid(contentX, GRID_SIZE);
    const snappedY = snapToGrid(contentY, GRID_SIZE);

    element.style.left = `${snappedX}px`;
    element.style.top = `${snappedY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingElement) {
      isDraggingElement = false;
      element.style.zIndex = '1';
    }
  });
}

// Unterbindet das Standard-Rechtsklick-Menü auf dem gesamten Viewport
viewport.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
});