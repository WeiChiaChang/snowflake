const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      width: 520px;
    }

    :host:focus {
      outline: none;
    }

    :host svg {
      width: 520px;
      height: 600px;
    }

    path {
      transition: stroke var(--transition);
    }

    path:hover {
      stroke: aqua;
      cursor: pointer;
    }

    .slice-tip {
      font-size: 9px;
      opacity: .5;
      user-select: none;
    }

    .highlight {
      stroke: orangered;
    }
    .highlight:hover {
      stroke: crimson;
    }

    .controls {
      margin-top: 2rem;
    }

    .control {
      padding: .25rem 1rem;
      background: var(--color-base);
      border: 0;
      border-radius: .25rem;
      transition: all var(--transition);
      box-shadow: 0 0 0 2px transparent inset;
      text-decoration: none;
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }
    .control:not(:disabled):hover {
      background: transparent;
      box-shadow:  0 0 0 2px var(--color-base) inset;
      color: var(--color-base);
    }
    .control:disabled {
      cursor: not-allowed;
      opacity: .5;
      color: var(--color-texttransp);
    }
  </style>

  <div class="content">
    <svg class="snowflake"
      viewBox="0 0 260 300"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <path id="slice-shape" d="M130.1,300.5, 130.1,0, 0,75z"></path>

        <clipPath id="slice-clip-path">
          <use xlink:href="#slice-shape"/>
        </clipPath>
      </defs>

      <!-- Shape for measuring SVG scaling -->
      <rect id="measure-rect"
        fill="transparent"
        x="0" y="0"
        width="100" height="100"></rect>

      <text class="slice-tip"
          stroke="none"
          fill="currentColor"
          text-anchor="middle"
          y="62" x="30"
          transform="rotate(-30)">Paint here</text>

      <g id="slice" fill="none" stroke="currentColor">
        <!-- Contour -->
        <use xlink:href="#slice-shape"
          stroke-dasharray="5 2.5"
          stroke-width=".5"
          stroke-opacity=".5"/>
        <!-- Clipped slice content -->
        <g clip-path="url(#slice-clip-path)"
          id="target-group"
          stroke-linecap="round"
          stroke-width="5">
        </g>
      </g>

      <!-- Mirrored slice to show symmetry -->
      <use
        xlink:href="#slice"
        transform="translate(260,0) scale(-1,1)"
        style="opacity:.25"
        />
    </svg>
  </div>

  <div class="controls">
    <button type="button" class="control control--clear">Clear</button>
  </div>
`;

export default class SnowFlakeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.elem = this.shadowRoot;
    this.elem.appendChild(template.content.cloneNode(true));
    this.snowflake = this.elem.querySelector('.snowflake');
    this.targetGroup = this.elem.querySelector('#target-group');
    this.controlClear = this.elem.querySelector('.control--clear');
    this.controlClear.disabled = true;
    this.scale = this.getScale();
    this.clickedPath = null;
    this.pathsCounter = 0;
    this.selected = {};

    this.targetGroupMouseDown = this.targetGroupMouseDown.bind(this);
    this.clear = this.clear.bind(this);
    this.unselect = this.unselect.bind(this);
    this.mouseDown = this.mouseDown.bind(this);
    this.mouseUp = this.mouseUp.bind(this);
    this.mouseMove = this.mouseMove.bind(this);
    this.bodyKeyUp = this.bodyKeyUp.bind(this);
  }

  connectedCallback() {
    this.snowflake.addEventListener('mousedown', this.mouseDown);
    this.snowflake.addEventListener('mouseup', this.mouseUp);
    // Catch events for path inside paths group
    this.targetGroup.addEventListener('mousedown', this.targetGroupMouseDown);

    this.controlClear.addEventListener('click', this.clear);

    document.addEventListener('keyup', this.bodyKeyUp);
  }

  disconnectedCallback() {
    this.snowflake.removeEventListener('mousedown', this.mouseDown);
    this.snowflake.removeEventListener('mouseup', this.mouseUp);
    this.targetGroup.removeEventListener('mousedown', this.targetGroupMouseDown);
    this.controlClear.removeEventListener('click', this.clear);
    document.removeEventListener('keyup', this.bodyKeyUp);
  }

  getMouseOffset(event) {
    let {left, top} = this.snowflake.getBoundingClientRect();
    let scale = this.scale;
    return {
      x: scale * (event.clientX - left),
      y: scale * (event.clientY - top)
    };
  }

  bodyKeyUp(event) {
    if(event.keyCode === 8 || event.keyCode === 46) {
      this.removePaths();
    }
  }

  mouseDown(event) {
    // Start draw line, create path
    let elem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let start = this.getMouseOffset(event);
    this.path = {
      elem,
      start
    };

    this.targetGroup.append(elem);

    this.snowflake.addEventListener('mousemove', this.mouseMove);
  }

  mouseMove(event) {
    // Move path end to pointer coordinates
    let {x, y} = this.getMouseOffset(event);
    let {start} = this.path;
    this.path.elem.setAttribute(
      'd',
      `M${start.x},${start.y} ${x},${y}`);

    this.clickedPath = null;
  }

  mouseUp(event) {
    // Prevent fire event on parent
    // after handling path by child
    if(!this.path) {
      return;
    }

    // Catch click to highlight path
    if(this.clickedPath) {
      this.mouseClickPath();

      // Remove latest path
      this.path.elem.remove();
      this.snowflake.removeEventListener('mousemove', this.mouseMove);
      return;
    }

    this.unselect();

    // Or fix new path
    this.path.elem.id = `path-${this.pathsCounter}`;
    this.pathsCounter++;

    let {x, y} = this.getMouseOffset(event);
    let {start} = this.path;

    this.path.elem.setAttribute(
      'd',
      `M${start.x},${start.y} ${x},${y}`);

    this.snowflake.removeEventListener('mousemove', this.mouseMove);
    this.path = null;
    this.dispatchChange();
  }

  mouseClickPath() {
    const pathId = this.clickedPath.id;
      this.clickedPath.classList.toggle('highlight');

      if(this.clickedPath.classList.contains('highlight')) {
        this.selected[pathId] = this.clickedPath;
      }
      else {
        delete this.selected[pathId];
    }

    this.clickedPath = null;
  }

  dispatchChange() {
    const pathStr = this.getSinglePathStr();
    this.controlClear.disabled = !pathStr;

    document.dispatchEvent(new CustomEvent('change-view', {
      detail: {
        groupContent: pathStr
      },
      bubbles: true,
    }));
  }

  getSinglePathStr() {
    this.targetGroup.children.map = [].map;
    let singlePathCoords = '';

    for(let item of this.targetGroup.children) {
      singlePathCoords += ` ${item.getAttribute('d')}`;
    }

    if(!singlePathCoords) {
      return '';
    }

    return `<path d="${singlePathCoords}"/>`;
  }

  targetGroupMouseDown(event) {
    this.clickedPath = event.target;
  }

  unselect() {
    if(Object.values(this.selected).length > 0) {
      for(let key in this.selected) {
        this.selected[key].classList.remove('highlight');
        delete this.selected[key];
      }
    }
  }

  removePaths() {
    if(Object.values(this.selected).length > 0) {
      for(let key in this.selected) {
        this.selected[key].remove();
        delete this.selected[key];
      }

      this.dispatchChange();
    }
  }

  clear() {
    this.targetGroup.innerHTML = '';
    this.selected = {};
    this.dispatchChange();
  }

  // Return scale value if svg was resized
  getScale() {
    const measurePath = this.elem.getElementById('measure-rect');
    const width = measurePath.getAttribute('width');
    const rect = measurePath.getBoundingClientRect();

    return width / rect.width;
  }

}
