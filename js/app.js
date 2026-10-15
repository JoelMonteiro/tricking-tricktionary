/*
 * Tricktionary - toda a página é gerada a partir de data/tricks.json.
 *
 *  - Níveis em acordeão com os tricks de cada um
 *  - Pesquisa em todos os níveis (ignora maiúsculas, acentos, hífenes e espaços)
 *  - Detalhe de cada trick: vídeo, descrição, pré-requisitos, o que desbloqueia
 *    e o mapa de progressão (o caminho desde os tricks base até este)
 *  - Link direto para um trick: index.html#trick/540
 */
(function () {
    'use strict';

    var DATA_URL = 'data/tricks.json';
    var PLACEHOLDER_VIDEO = 'media/videos/placeholder.mp4';

    var levels = [];          // [{id, name, description}]
    var tricks = {};          // id -> trick
    var unlocks = {};         // id -> [ids que têm este trick como pré-requisito]
    var levelOrder = {};      // levelId -> índice (para ordenar)
    var openLevels = {};      // levelId -> true/false (estado escolhido pelo utilizador)

    var el = {
        levels: document.getElementById('levels'),
        search: document.getElementById('searchInput'),
        searchResults: document.getElementById('searchResults'),
        noResults: document.getElementById('noResults'),
        loadError: document.getElementById('loadError'),
        count: document.getElementById('trickCount'),
        modal: $('#trickModal'),
        title: document.getElementById('trickTitle'),
        level: document.getElementById('trickLevel'),
        video: document.getElementById('trickVideo'),
        description: document.getElementById('trickDescription'),
        prereqSection: document.getElementById('prereqSection'),
        prereqHint: document.getElementById('prereqHint'),
        prereqList: document.getElementById('prereqList'),
        unlockSection: document.getElementById('unlockSection'),
        unlockList: document.getElementById('unlockList'),
        mapSection: document.getElementById('mapSection'),
        map: document.getElementById('progressionMap')
    };

    // ------------------------------------------------------------------ dados

    fetch(DATA_URL)
        .then(function (response) {
            if (!response.ok) { throw new Error(response.status); }
            return response.json();
        })
        .then(init)
        .catch(function (error) {
            console.error('Tricktionary: failed to load data', error);
            el.loadError.hidden = false;
        });

    function init(data) {
        levels = data.levels;
        levels.forEach(function (level, i) {
            levelOrder[level.id] = i;
            openLevels[level.id] = (i === 0); // só o 1.º nível começa aberto
        });

        data.tricks.forEach(function (trick) {
            trick.searchKey = normalize(trick.name);
            tricks[trick.id] = trick;
            unlocks[trick.id] = [];
        });
        data.tricks.forEach(function (trick) {
            trick.prerequisites = (trick.prerequisites || []).filter(function (id) { return tricks[id]; });
            trick.prerequisites.forEach(function (id) { unlocks[id].push(trick.id); });
        });

        el.count.textContent = data.tricks.length + ' tricks';
        renderLevels(data.tricks);
        bindEvents();
        openFromHash();
    }

    // ------------------------------------------------------------------ render da lista

    function renderLevels(allTricks) {
        var fragment = document.createDocumentFragment();

        levels.forEach(function (level) {
            var levelTricks = allTricks.filter(function (t) { return t.level === level.id; });

            var header = document.createElement('button');
            header.type = 'button';
            header.className = 'accordion';
            header.id = 'level-' + level.id;
            header.dataset.level = level.id;
            header.setAttribute('aria-controls', 'panel-' + level.id);
            header.innerHTML = '<span class="level-name"></span><span class="level-count"></span>';
            header.querySelector('.level-name').textContent = level.name;
            header.querySelector('.level-count').textContent = levelTricks.length;
            header.dataset.total = levelTricks.length;

            var panel = document.createElement('div');
            panel.className = 'panel';
            panel.id = 'panel-' + level.id;
            panel.dataset.level = level.id;

            var description = document.createElement('p');
            description.className = 'level-description text-muted';
            description.textContent = level.description;
            panel.appendChild(description);

            var grid = document.createElement('div');
            grid.className = 'trick-grid';
            levelTricks.forEach(function (trick) {
                var button = document.createElement('button');
                button.type = 'button';
                button.className = 'trick-btn';
                button.dataset.trick = trick.id;
                button.textContent = trick.name;
                grid.appendChild(button);
            });
            panel.appendChild(grid);

            fragment.appendChild(header);
            fragment.appendChild(panel);
        });

        el.levels.appendChild(fragment);
        applyLevelState();
    }

    function applyLevelState(forceOpen) {
        levels.forEach(function (level) {
            var open = forceOpen ? forceOpen(level.id) : openLevels[level.id];
            var header = document.getElementById('level-' + level.id);
            var panel = document.getElementById('panel-' + level.id);
            header.classList.toggle('active', open);
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
            panel.hidden = !open;
        });
    }

    // ------------------------------------------------------------------ eventos

    function bindEvents() {
        el.levels.addEventListener('click', function (event) {
            var header = event.target.closest('.accordion');
            if (header) {
                if (el.search.value.trim()) { return; } // durante a pesquisa os níveis abrem sozinhos
                var id = header.dataset.level;
                openLevels[id] = !openLevels[id];
                applyLevelState();
                return;
            }
            var button = event.target.closest('.trick-btn');
            if (button) {
                showTrick(button.dataset.trick);
            }
        });

        el.search.addEventListener('input', function () { search(el.search.value); });
        el.search.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                el.search.value = '';
                search('');
            }
        });

        // chips dentro do modal (pré-requisitos, desbloqueia, mapa) abrem outro trick
        document.getElementById('trickModal').addEventListener('click', function (event) {
            var chip = event.target.closest('.chip[data-trick]');
            if (chip && !chip.classList.contains('current')) {
                showTrick(chip.dataset.trick);
            }
        });

        el.video.addEventListener('error', function () {
            if (el.video.getAttribute('src') !== PLACEHOLDER_VIDEO) {
                el.video.src = PLACEHOLDER_VIDEO; // vídeo do trick ainda não existe
            }
        });

        el.modal.on('hidden.bs.modal', function () {
            el.video.pause();
            if (location.hash) {
                history.replaceState(null, '', location.pathname + location.search);
            }
        });

        window.addEventListener('hashchange', openFromHash);
    }

    // ------------------------------------------------------------------ pesquisa

    function normalize(text) {
        return text
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function search(query) {
        var tokens = query.trim().split(/\s+/).map(normalize).filter(Boolean);
        var buttons = el.levels.querySelectorAll('.trick-btn');
        var matchesPerLevel = {};
        var total = 0;

        Array.prototype.forEach.call(buttons, function (button) {
            var trick = tricks[button.dataset.trick];
            var match = tokens.every(function (token) { return trick.searchKey.indexOf(token) !== -1; });
            button.hidden = !match;
            highlight(button, trick.name, match ? query : '');
            if (match) {
                matchesPerLevel[trick.level] = (matchesPerLevel[trick.level] || 0) + 1;
                total++;
            }
        });

        levels.forEach(function (level) {
            var visible = !tokens.length || matchesPerLevel[level.id] > 0;
            var header = document.getElementById('level-' + level.id);
            header.hidden = !visible;
            header.querySelector('.level-count').textContent = tokens.length
                ? (matchesPerLevel[level.id] || 0) + ' / ' + header.dataset.total
                : header.dataset.total;
            document.getElementById('panel-' + level.id).querySelector('.level-description').hidden = tokens.length > 0;
            if (!visible) { document.getElementById('panel-' + level.id).hidden = true; }
        });

        if (tokens.length) {
            applyLevelState(function (id) { return matchesPerLevel[id] > 0; });
            el.searchResults.textContent = total + (total === 1 ? ' result' : ' results');
        } else {
            applyLevelState();
            el.searchResults.textContent = '';
        }
        el.noResults.hidden = !(tokens.length && total === 0);
    }

    function highlight(button, name, query) {
        var words = query.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
            button.textContent = name;
            return;
        }
        var escaped = words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
        var regex = new RegExp('(' + escaped.join('|') + ')', 'gi');
        button.textContent = '';
        name.split(regex).forEach(function (part, i) {
            if (i % 2 === 1) {
                var mark = document.createElement('mark');
                mark.textContent = part;
                button.appendChild(mark);
            } else if (part) {
                button.appendChild(document.createTextNode(part));
            }
        });
    }

    // ------------------------------------------------------------------ detalhe do trick

    function levelName(levelId) {
        var level = levels[levelOrder[levelId]];
        return level ? level.name : '';
    }

    function chip(id, extraClass) {
        var trick = tricks[id];
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip' + (extraClass ? ' ' + extraClass : '');
        button.dataset.trick = id;
        button.textContent = trick.name;
        var level = document.createElement('small');
        level.textContent = levelName(trick.level);
        button.appendChild(level);
        return button;
    }

    function fillChips(container, ids, emptyText) {
        container.textContent = '';
        if (!ids.length) {
            var empty = document.createElement('span');
            empty.className = 'empty-hint';
            empty.textContent = emptyText;
            container.appendChild(empty);
            return;
        }
        ids.slice()
            .sort(function (a, b) {
                return (levelOrder[tricks[a].level] - levelOrder[tricks[b].level]) ||
                    tricks[a].name.localeCompare(tricks[b].name);
            })
            .forEach(function (id) { container.appendChild(chip(id)); });
    }

    function showTrick(id) {
        var trick = tricks[id];
        if (!trick) { return; }

        el.title.textContent = trick.name;
        el.level.textContent = levelName(trick.level);
        el.description.textContent = trick.description || '';
        el.video.src = trick.video || PLACEHOLDER_VIDEO;

        el.prereqHint.textContent = trick.prerequisites.length
            ? 'Master these tricks before attempting the ' + trick.name + ':'
            : '';
        fillChips(el.prereqList, trick.prerequisites, 'None: this is a foundation trick.');
        fillChips(el.unlockList, unlocks[id], 'Nothing yet.');
        el.unlockSection.hidden = unlocks[id].length === 0;
        renderProgressionMap(id);

        var hash = '#trick/' + id;
        if (location.hash !== hash) {
            history.replaceState(null, '', hash);
        }
        el.modal.find('.modal-body').scrollTop(0);
        if (el.modal.hasClass('show')) {
            // ao navegar por um chip, o botão clicado desaparece; o foco volta ao modal para o Esc continuar a fechar
            el.modal.trigger('focus');
        } else {
            el.modal.modal('show');
        }
    }

    /**
     * Mapa de progressão: todos os antecessores do trick, agrupados por "passo".
     * Passo de um trick = 1 + o maior passo entre os seus pré-requisitos (os tricks base são o passo 1).
     */
    function renderProgressionMap(id) {
        var steps = {};

        function step(tid) {
            if (steps[tid]) { return steps[tid]; }
            var pre = tricks[tid].prerequisites;
            steps[tid] = 1 + (pre.length ? Math.max.apply(null, pre.map(step)) : 0);
            return steps[tid];
        }
        step(id);

        el.map.textContent = '';
        var ids = Object.keys(steps);
        el.mapSection.hidden = ids.length <= 1; // sem pré-requisitos não há caminho para mostrar
        if (ids.length <= 1) { return; }

        var maxStep = steps[id];
        for (var s = 1; s <= maxStep; s++) {
            var inStep = ids.filter(function (tid) { return steps[tid] === s; });
            var li = document.createElement('li');
            var list = document.createElement('div');
            list.className = 'chip-list';
            inStep.sort(function (a, b) { return tricks[a].name.localeCompare(tricks[b].name); })
                .forEach(function (tid) { list.appendChild(chip(tid, tid === id ? 'current' : '')); });
            if (s === maxStep) { li.className = 'current'; }
            li.appendChild(list);
            el.map.appendChild(li);
        }
    }

    function openFromHash() {
        var match = /^#trick\/(.+)$/.exec(location.hash);
        if (match && tricks[decodeURIComponent(match[1])]) {
            showTrick(decodeURIComponent(match[1]));
        }
    }
})();
