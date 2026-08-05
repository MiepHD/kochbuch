const GRID_SIZE = 20;

const viewport = document.getElementById('viewport') as HTMLDivElement;
const canvas = document.getElementById('canvas') as HTMLDivElement;
const svgLayer = document.getElementById('svg-layer') as unknown as SVGSVGElement;

let scale = 1;
let panX = 0;
let panY = 0;

let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let draggedType: string | null = null;
let elementIdCounter = 0;

// Verbindungs-State
interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  line: SVGLineElement;
}

const connections: Connection[] = [];
let isConnecting = false;
let connectingSourceId: string | null = null;
let tempLine: SVGLineElement | null = null;

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function updateTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  const currentGridSize = GRID_SIZE * scale;
  viewport.style.backgroundSize = `${currentGridSize}px ${currentGridSize}px`;
  viewport.style.backgroundPosition = `${panX}px ${panY}px`;
}
updateTransform();

// 1. Pan-Funktionalität
viewport.addEventListener('mousedown', (e: MouseEvent) => {
  if (e.button !== 2) return;
  viewport.style.setProperty("cursor", "grabbing");

  isPanning = true;
  startPanX = e.clientX - panX;
  startPanY = e.clientY - panY;
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  // Pan ausführen
  if (isPanning) {
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform();
    return;
  }

  // Vorschau-Pfeil beim Linksklick-Ziehen aktualisieren
  if (isConnecting && tempLine && connectingSourceId) {
    const sourceElem = document.getElementById(connectingSourceId);
    if (!sourceElem) return;

    const sourceCenter = getElementCenter(sourceElem);
    const rect = viewport.getBoundingClientRect();
    const currentCanvasX = (e.clientX - rect.left - panX) / scale;
    const currentCanvasY = (e.clientY - rect.top - panY) / scale;

    tempLine.setAttribute('x1', sourceCenter.x.toString());
    tempLine.setAttribute('y1', sourceCenter.y.toString());
    tempLine.setAttribute('x2', currentCanvasX.toString());
    tempLine.setAttribute('y2', currentCanvasY.toString());
  }
});

window.addEventListener('mouseup', (e: MouseEvent) => {
  if (isPanning) {
    isPanning = false;
    viewport.style.removeProperty("cursor");
  }

  // Verbindung abschließen
  if (isConnecting) {
    if (tempLine) {
      tempLine.remove();
      tempLine = null;
    }

    // Prüfen, ob die Maus über einem Ziel-Element losgelassen wurde
    const targetElement = document.elementFromPoint(e.clientX, e.clientY)?.closest('.placed-element') as HTMLDivElement | null;
    
    if (targetElement && connectingSourceId && targetElement.id !== connectingSourceId) {
      createConnection(connectingSourceId, targetElement.id);
    }

    isConnecting = false;
    connectingSourceId = null;
  }
});

// 2. Zoom-Funktionalität
viewport.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();

  const zoomIntensity = 0.1;
  const oldScale = scale;

  if (e.deltaY < 0) {
    scale = Math.min(scale * (1 + zoomIntensity), 4);
  } else {
    scale = Math.max(scale * (1 - zoomIntensity), 0.2);
  }

  const rect = viewport.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  panX = mouseX - (mouseX - panX) * (scale / oldScale);
  panY = mouseY - (mouseY - panY) * (scale / oldScale);

  updateTransform();
}, { passive: false });

// 3. Drag & Drop aus der Seitenleiste
const draggableItems = document.querySelectorAll<HTMLDivElement>('.draggable-item');
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
  element.id = `elem-${++elementIdCounter}`;

  const label = document.createElement('span');
  label.innerText = type === 'card' ? 'Neue Karte' : 'Neuer Button';
  element.appendChild(label);

  const deleteBtn = document.createElement('button');
  deleteBtn.innerText = '×';
  deleteBtn.classList.add('delete-btn');
  deleteBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    removeElement(element.id);
  });
  element.appendChild(deleteBtn);

  element.style.left = `${x}px`;
  element.style.top = `${y}px`;

  makeElementInteractable(element);
  canvas.appendChild(element);
}

// 5. Interaktion & Verschieben für platzierte Elemente
function makeElementInteractable(element: HTMLDivElement): void {
  let isDraggingElement = false;
  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation();

    // Linksklick: Pfeilverbindung starten
    if (e.button === 0) {
      isConnecting = true;
      connectingSourceId = element.id;

      // Temporäre Linie im SVG erstellen
      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.classList.add('temp-line');
      svgLayer.appendChild(tempLine);
      return;
    }

    // Rechtsklick: Element auf Canvas verschieben
    if (e.button === 2) {
      isDraggingElement = true;

      const rect = viewport.getBoundingClientRect();
      const mouseXInViewport = e.clientX - rect.left;
      const mouseYInViewport = e.clientY - rect.top;

      const contentMouseX = (mouseXInViewport - panX) / scale;
      const contentMouseY = (mouseYInViewport - panY) / scale;

      offsetX = contentMouseX - element.offsetLeft;
      offsetY = contentMouseY - element.offsetTop;

      element.style.setProperty("z-index", "10");
    }
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

    // Alle angebundenen Pfeile beim Verschieben aktualisieren
    updateAllConnectionsForElement(element.id);
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingElement) {
      isDraggingElement = false;
      element.style.removeProperty("z-index");
    }
  });
}

// 6. Verbindungs-Logik & Berechnungen
function getElementCenter(elem: HTMLElement) {
  return {
    x: elem.offsetLeft + elem.offsetWidth / 2,
    y: elem.offsetTop + elem.offsetHeight / 2,
  };
}

function createConnection(sourceId: string, targetId: string) {
  // Duplikate vermeiden
  const exists = connections.some(c => c.sourceId === sourceId && c.targetId === targetId);
  if (exists) return;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.classList.add('connection-line');

  const connection: Connection = {
    id: `conn-${Date.now()}`,
    sourceId,
    targetId,
    line
  };

  svgLayer.appendChild(line);
  connections.push(connection);
  updateConnectionPos(connection);
}

function updateConnectionPos(connection: Connection) {
  const sourceElem = document.getElementById(connection.sourceId);
  const targetElem = document.getElementById(connection.targetId);

  if (!sourceElem || !targetElem) return;

  const sourcePos = getElementCenter(sourceElem);
  const targetPos = getElementCenter(targetElem);

  connection.line.setAttribute('x1', sourcePos.x.toString());
  connection.line.setAttribute('y1', sourcePos.y.toString());
  connection.line.setAttribute('x2', targetPos.x.toString());
  connection.line.setAttribute('y2', targetPos.y.toString());
}

function updateAllConnectionsForElement(elementId: string) {
  connections
    .filter(c => c.sourceId === elementId || c.targetId === elementId)
    .forEach(updateConnectionPos);
}

function removeElement(elementId: string) {
  // Zugehörige Verbindungen entfernen
  for (let i = connections.length - 1; i >= 0; i--) {
    if (connections[i].sourceId === elementId || connections[i].targetId === elementId) {
      connections[i].line.remove();
      connections.splice(i, 1);
    }
  }

  // Element löschen
  document.getElementById(elementId)?.remove();
}

viewport.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
});