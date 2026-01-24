/**
 * Export Button UI Components
 * 
 * Uses GitHub's native CSS classes for consistent styling.
 * Inspired by refined-github's approach.
 * Dropdown uses GitHub's Primer React Component (PRC) ActionList classes.
 */

export interface MenuAction {
  icon: string;
  text: string;
  action: () => void | Promise<void>;
  isExternal?: boolean;
}

export interface ExportButtonOptions {
  id: string;
  mainButtonText: string;
  onMainClick: () => void | Promise<void>;
  menuActions: MenuAction[];
  isPR?: boolean;
  isIssue?: boolean;
  isDiscussion?: boolean;
}

// SVG Icons for button states
const ICONS = {
  copy: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`,
  check: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
  error: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`,
  spinner: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor" class="rgh-spinning"><path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5.75.75 0 0 1 1.5 0 8 8 0 1 1-8-8 .75.75 0 0 1 0 1.5Z"/></svg>`,
  triangleDown: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>`,
  download: `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"/></svg>`,
  external: `<svg aria-hidden="true" height="12" viewBox="0 0 16 16" width="12" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"/></svg>`,
};

/**
 * Create the export button group (main button + dropdown)
 * Uses GitHub's native BtnGroup styling
 */
export function createExportButtonGroup(options: ExportButtonOptions): HTMLDivElement {
  const { id, mainButtonText, onMainClick, menuActions, isPR, isIssue, isDiscussion } = options;

  // Create wrapper with BtnGroup class for GitHub native styling
  const wrapper = document.createElement('div');
  wrapper.id = `${id}-group`;
  wrapper.className = 'BtnGroup rgh-export-wrapper';
  if (isIssue) wrapper.classList.add('rgh-export-grow');
  if (isPR) wrapper.classList.add('rgh-export-pr');
  if (isDiscussion) wrapper.classList.add('rgh-export-discussion');
  wrapper.style.cssText = 'position: relative; display: inline-flex;';

  // Create main export button using GitHub's btn classes
  const mainButton = document.createElement('button');
  mainButton.id = id;
  mainButton.type = 'button';
  mainButton.className = 'btn btn-sm BtnGroup-item rgh-export-btn';
  mainButton.innerHTML = `${ICONS.copy}<span data-component="text" class="prc-Button-Label-FWkx3">${mainButtonText}</span>`;
  mainButton.addEventListener('click', () => onMainClick());

  // Create dropdown toggle button
  const dropdownButton = document.createElement('button');
  dropdownButton.id = `${id}-dropdown`;
  dropdownButton.type = 'button';
  dropdownButton.className = 'btn btn-sm BtnGroup-item rgh-export-dropdown';
  dropdownButton.innerHTML = ICONS.triangleDown;

  // Create dropdown menu
  const menu = createDropdownMenu(`${id}-menu`, menuActions);

  // Dropdown toggle handler
  dropdownButton.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('rgh-open');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      menu.classList.remove('rgh-open');
    }
  });

  wrapper.appendChild(mainButton);
  wrapper.appendChild(dropdownButton);
  wrapper.appendChild(menu);

  return wrapper;
}

/**
 * Create the dropdown menu using GitHub's native ActionList structure
 * Matches the exact structure from GitHub's Primer React Components
 */
function createDropdownMenu(id: string, actions: MenuAction[]): HTMLDivElement {
  // Outer overlay container (matches GitHub's structure)
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'rgh-export-menu prc-Overlay-Overlay-jfs-T';
  overlay.setAttribute('role', 'none');
  overlay.setAttribute('data-component', 'AnchoredOverlay');

  // Action menu container
  const container = document.createElement('div');
  container.className = 'prc-ActionMenu-ActionMenuContainer-Om1Qz';
  container.setAttribute('data-variant', 'anchored');

  // Action list (ul)
  const list = document.createElement('ul');
  list.className = 'prc-ActionList-ActionList-rPFF2';
  list.setAttribute('role', 'menu');
  list.setAttribute('data-dividers', 'false');
  list.setAttribute('data-variant', 'inset');

  for (const action of actions) {
    const li = document.createElement('li');
    li.setAttribute('role', 'menuitem');
    li.setAttribute('tabindex', '0');
    li.setAttribute('data-has-description', 'false');
    li.className = 'prc-ActionList-ActionListItem-So4vC';

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'prc-ActionList-ActionListContent-KBb8-';
    content.setAttribute('data-size', 'medium');

    // Spacer (matches GitHub's structure)
    const spacer = document.createElement('span');
    spacer.className = 'prc-ActionList-Spacer-4tR2m';
    content.appendChild(spacer);

    // Leading visual (icon wrapper)
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'prc-ActionList-LeadingVisual-NBr28 prc-ActionList-VisualWrap-bdCsS';
    iconWrapper.innerHTML = action.icon;
    content.appendChild(iconWrapper);

    // Label wrapper
    const labelWrapper = document.createElement('span');
    labelWrapper.className = 'prc-ActionList-ActionListSubContent-gKsFp';
    labelWrapper.setAttribute('data-component', 'ActionList.Item--DividerContainer');

    const label = document.createElement('span');
    label.className = 'prc-ActionList-ItemLabel-81ohH';
    label.textContent = action.text;
    labelWrapper.appendChild(label);
    content.appendChild(labelWrapper);

    // External link indicator (trailing visual)
    if (action.isExternal) {
      const trailingWrapper = document.createElement('span');
      trailingWrapper.className = 'prc-ActionList-TrailingVisual-eCMfG prc-ActionList-VisualWrap-bdCsS';
      trailingWrapper.innerHTML = ICONS.external;
      content.appendChild(trailingWrapper);
    }

    li.appendChild(content);

    // Click handler
    li.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.remove('rgh-open');
      action.action();
    });

    // Keyboard handler
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove('rgh-open');
        action.action();
      }
    });

    list.appendChild(li);
  }

  container.appendChild(list);
  overlay.appendChild(container);

  return overlay;
}

/**
 * Update button state (loading, success, error)
 */
export function updateButtonState(
  buttonId: string,
  state: 'loading' | 'success' | 'error' | 'idle',
  text?: string
): void {
  const btn = document.getElementById(buttonId) as HTMLButtonElement | null;
  if (!btn) return;

  const textElement = btn.querySelector<HTMLElement>('.prc-Button-Label-FWkx3');

  // Remove any existing state SVGs and add new one
  const existingSvg = btn.querySelector('svg');

  switch (state) {
    case 'loading':
      if (textElement) textElement.textContent = text || 'Exporting...';
      if (existingSvg) existingSvg.outerHTML = ICONS.spinner;
      btn.disabled = true;
      break;

    case 'success':
      if (textElement) textElement.textContent = text || 'Copied!';
      if (existingSvg) existingSvg.outerHTML = ICONS.check;
      btn.disabled = false;
      break;

    case 'error':
      if (textElement) textElement.textContent = text || 'Failed';
      if (existingSvg) existingSvg.outerHTML = ICONS.error;
      btn.disabled = false;
      break;

    case 'idle':
      if (textElement) textElement.textContent = text || 'Copy to Markdown';
      if (existingSvg) existingSvg.outerHTML = ICONS.copy;
      btn.disabled = false;
      break;
  }
}

/**
 * Reset button to idle state after a delay
 */
export function resetButtonAfterDelay(buttonId: string, defaultText: string, delay = 2000): void {
  setTimeout(() => {
    updateButtonState(buttonId, 'idle', defaultText);
  }, delay);
}

/**
 * Get icon HTML for menu items
 * AI provider icons sourced from @lobehub/icons (mono variants)
 */
export const MENU_ICONS = {
  download: ICONS.download,
  // OpenAI/ChatGPT - from @lobehub/icons/OpenAI
  chatgpt: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/></svg>`,
  // Claude - from @lobehub/icons/Claude
  claude: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/></svg>`,
  // Gemini - from @lobehub/icons/Gemini
  gemini: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"/></svg>`,
  // GitHub Copilot - from @lobehub/icons/GithubCopilot
  copilot: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.245 5.364c1.322 1.36 1.877 3.216 2.11 5.817.622 0 1.2.135 1.592.654l.73.964c.21.278.323.61.323.955v2.62c0 .339-.173.669-.453.868C20.239 19.602 16.157 21.5 12 21.5c-4.6 0-9.205-2.583-11.547-4.258-.28-.2-.452-.53-.453-.868v-2.62c0-.345.113-.679.321-.956l.73-.963c.392-.517.974-.654 1.593-.654l.029-.297c.25-2.446.81-4.213 2.082-5.52 2.461-2.54 5.71-2.851 7.146-2.864h.198c1.436.013 4.685.323 7.146 2.864zm-7.244 4.328c-.284 0-.613.016-.962.05-.123.447-.305.85-.57 1.108-1.05 1.023-2.316 1.18-2.994 1.18-.638 0-1.306-.13-1.851-.464-.516.165-1.012.403-1.044.996a65.882 65.882 0 00-.063 2.884l-.002.48c-.002.563-.005 1.126-.013 1.69.002.326.204.63.51.765 2.482 1.102 4.83 1.657 6.99 1.657 2.156 0 4.504-.555 6.985-1.657a.854.854 0 00.51-.766c.03-1.682.006-3.372-.076-5.053-.031-.596-.528-.83-1.046-.996-.546.333-1.212.464-1.85.464-.677 0-1.942-.157-2.993-1.18-.266-.258-.447-.661-.57-1.108-.32-.032-.64-.049-.96-.05zm-2.525 4.013c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zm5 0c.539 0 .976.426.976.95v1.753c0 .525-.437.95-.976.95a.964.964 0 01-.976-.95v-1.752c0-.525.437-.951.976-.951zM7.635 5.087c-1.05.102-1.935.438-2.385.906-.975 1.037-.765 3.668-.21 4.224.405.394 1.17.657 1.995.657h.09c.649-.013 1.785-.176 2.73-1.11.435-.41.705-1.433.675-2.47-.03-.834-.27-1.52-.63-1.813-.39-.336-1.275-.482-2.265-.394zm6.465.394c-.36.292-.6.98-.63 1.813-.03 1.037.24 2.06.675 2.47.968.957 2.136 1.104 2.776 1.11h.044c.825 0 1.59-.263 1.995-.657.555-.556.765-3.187-.21-4.224-.45-.468-1.335-.804-2.385-.906-.99-.088-1.875.058-2.265.394zM12 7.615c-.24 0-.525.015-.84.044.03.16.045.336.06.526l-.001.159a2.94 2.94 0 01-.014.25c.225-.022.425-.027.612-.028h.366c.187 0 .387.006.612.028-.015-.146-.015-.277-.015-.409.015-.19.03-.365.06-.526a9.29 9.29 0 00-.84-.044z"/></svg>`,
  // Perplexity - from @lobehub/icons/Perplexity
  perplexity: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z"/></svg>`,
  // Mistral (Le Chat) - from @lobehub/icons/Mistral
  lechat: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path clip-rule="evenodd" d="M3.428 3.4h3.429v3.428h3.429v3.429h-.002 3.431V6.828h3.427V3.4h3.43v13.714H24v3.429H13.714v-3.428h-3.428v-3.429h-3.43v3.428h3.43v3.429H0v-3.429h3.428V3.4zm10.286 13.715h3.428v-3.429h-3.427v3.429z"/></svg>`,
  // Grok - from @lobehub/icons/Grok
  grok: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>`,
  // T3 Chat - custom icon (not in LobeHub)
  t3chat: `<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  // Wiki page icon
  wiki: `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 2.75A2.75 2.75 0 0 1 4.75 0h8.5A2.75 2.75 0 0 1 16 2.75v10.5A2.75 2.75 0 0 1 13.25 16h-8.5A2.75 2.75 0 0 1 2 13.25Zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V2.75c0-.69-.56-1.25-1.25-1.25ZM5 5.75A.75.75 0 0 1 5.75 5h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 5.75Zm0 3A.75.75 0 0 1 5.75 8h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 8.75Zm0 3a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>`,
};
