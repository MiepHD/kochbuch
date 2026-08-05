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

function updateTransform(): void {
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
  if (isPanning) {
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform();
    return;
  }

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

  if (isConnecting) {
    if (tempLine) {
      tempLine.remove();
      tempLine = null;
    }

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

    if (e.button === 0) {
      isConnecting = true;
      connectingSourceId = element.id;

      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tempLine.classList.add('temp-line');
      tempLine.setAttribute('marker-end', 'url(#arrowhead)');
      svgLayer.appendChild(tempLine);
      return;
    }

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

    updateAllConnectionsForElement(element.id);
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingElement) {
      isDraggingElement = false;
      element.style.removeProperty("z-index");
    }
  });
}

// 6. Verbindungs-Logik & Rand-Berechnung
function getElementCenter(elem: HTMLElement): { x: number; y: number } {
  return {
    x: elem.offsetLeft + elem.offsetWidth / 2,
    y: elem.offsetTop + elem.offsetHeight / 2,
  };
}

// Berechnet den Schnittpunkt einer Linie mit der Außenkante der Ziel-Box
function getIntersectionPoint(
  sourceCenter: { x: number; y: number },
  targetElem: HTMLElement
): { x: number; y: number } {
  const targetCenter = getElementCenter(targetElem);
  
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  
  if (dx === 0 && dy === 0) return targetCenter;

  const halfWidth = targetElem.offsetWidth / 2;
  const halfHeight = targetElem.offsetHeight / 2;

  // Verhältnis bezüglich der Box-Grenzen ermitteln
  const scaleX = Math.abs(halfWidth / dx);
  const scaleY = Math.abs(halfHeight / dy);
  const minScale = Math.min(scaleX, scaleY);

  return {
    x: targetCenter.x - dx * minScale,
    y: targetCenter.y - dy * minScale
  };
}

function createConnection(sourceId: string, targetId: string): void {
  const exists = connections.some(c => c.sourceId === sourceId && c.targetId === targetId);
  if (exists) return;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.classList.add('connection-line');
  line.setAttribute('marker-end', 'url(#arrowhead)');

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

function updateConnectionPos(connection: Connection): void {
  const sourceElem = document.getElementById(connection.sourceId);
  const targetElem = document.getElementById(connection.targetId);

  if (!sourceElem || !targetElem) return;

  const sourcePos = getElementCenter(sourceElem);
  // Stoppe die Linie exakt am Rand des Ziel-Elements statt in der Mitte:
  const targetEdgePos = getIntersectionPoint(sourcePos, targetElem);

  connection.line.setAttribute('x1', sourcePos.x.toString());
  connection.line.setAttribute('y1', sourcePos.y.toString());
  connection.line.setAttribute('x2', targetEdgePos.x.toString());
  connection.line.setAttribute('y2', targetEdgePos.y.toString());
}

function updateAllConnectionsForElement(elementId: string): void {
  connections
    .filter(c => c.sourceId === elementId || c.targetId === elementId)
    .forEach(updateConnectionPos);
}

function removeElement(elementId: string): void {
  for (let i = connections.length - 1; i >= 0; i--) {
    if (connections[i].sourceId === elementId || connections[i].targetId === elementId) {
      connections[i].line.remove();
      connections.splice(i, 1);
    }
  }

  document.getElementById(elementId)?.remove();
}

viewport.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault();
});