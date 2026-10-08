const searchableSelects = new WeakMap();
const internallyRenderedSelects = new WeakSet();

function searchableSelectOptionLabel(select) {
    const label = select.labels?.[0]?.textContent?.trim();
    return label || select.getAttribute('aria-label') || 'options';
}

function renderSearchableSelect(select, query = '') {
    const entry = searchableSelects.get(select);
    if (!entry) return;

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const selectedValue = select.value;
    const matchingOptions = entry.options.filter((option, index) => {
        if (index === 0 && option.value === '') return true;
        if (option.value === 'manual' || option.value === 'new' || option.dataset.searchPreserve !== undefined) return true;
        return !normalizedQuery || option.textContent.toLocaleLowerCase().includes(normalizedQuery);
    });

    internallyRenderedSelects.add(select);
    select.replaceChildren(...matchingOptions.map((option) => option.cloneNode(true)));

    if (normalizedQuery && matchingOptions.length <= 1) {
        const emptyOption = new Option('No matching options', '', true, true);
        emptyOption.disabled = true;
        select.append(emptyOption);
    }

    if ([...select.options].some((option) => option.value === selectedValue)) {
        select.value = selectedValue;
    } else if (!normalizedQuery) {
        select.value = '';
    }
}

function refreshSearchableSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const entry = searchableSelects.get(select);
    if (!entry) {
        initializeSearchableSelect(select);
        return;
    }

    entry.options = [...select.options].map((option) => option.cloneNode(true));
    renderSearchableSelect(select, entry.input.value);
}

function initializeSearchableSelect(select) {
    if (!(select instanceof HTMLSelectElement) || searchableSelects.has(select)) return;
    if (!select.matches('[data-searchable]') && select.options.length < 8) return;

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'select-search-input form-control';
    input.placeholder = `Search ${searchableSelectOptionLabel(select)}…`;
    input.setAttribute('aria-label', `Search ${searchableSelectOptionLabel(select)}`);
    input.autocomplete = 'off';

    const entry = {
        input,
        options: [...select.options].map((option) => option.cloneNode(true)),
    };
    searchableSelects.set(select, entry);
    select.before(input);

    input.addEventListener('input', () => renderSearchableSelect(select, input.value));
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            input.value = '';
            renderSearchableSelect(select);
            select.focus();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            select.focus();
            select.click();
        }
    });
    select.addEventListener('change', () => {
        if (!input.value) return;
        input.value = '';
        renderSearchableSelect(select);
    });
}

function initializeSearchableSelects(root = document) {
    if (root instanceof HTMLSelectElement) initializeSearchableSelect(root);
    root.querySelectorAll?.('select').forEach(initializeSearchableSelect);
}

window.refreshSearchableSelect = refreshSearchableSelect;
initializeSearchableSelects();

const searchableSelectObserver = new MutationObserver((mutations) => {
    const changedSelects = new Set();
    const addedNodes = [];

    mutations.forEach((mutation) => {
        if (mutation.target instanceof HTMLSelectElement) {
            changedSelects.add(mutation.target);
        }
        addedNodes.push(...mutation.addedNodes);
    });

    changedSelects.forEach((select) => {
        if (internallyRenderedSelects.has(select)) {
            internallyRenderedSelects.delete(select);
        } else if (searchableSelects.has(select)) {
            refreshSearchableSelect(select);
        } else {
            initializeSearchableSelect(select);
        }
    });

    addedNodes.forEach((node) => {
        if (node instanceof Element) initializeSearchableSelects(node);
    });
});

if (document.body) {
    searchableSelectObserver.observe(document.body, { childList: true, subtree: true });
}