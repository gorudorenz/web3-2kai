// DOM要素の取得
const calendarBody = document.querySelector('#calendar tbody');
const currentMonthYearDisplay = document.querySelector('#currentMonthYear');
const prevMonthButton = document.querySelector('#prevMonth');
const nextMonthButton = document.querySelector('#nextMonth');
const currentTimeDisplay = document.getElementById('currentTime');

// テンプレート定義 (タイトルのみ)
// ※ localStorage の templates があればそれを優先して読み込むように変更
let templates = JSON.parse(localStorage.getItem('templates')) || {
    "quick_meeting": ["早番"],
    "deep_work": ["遅番"],
    "check_email": ["小課題"],
    "short_break": ["課題"],
    "client_call": ["遊ぶ"]
};

// --- 変更: 薄いパステル調パレットとユーティリティ ---
const earthPalette = [
    '#FF3B30', // System Red
    '#FF9500', // System Orange
    '#FFCC00', // System Yellow
    '#34C759', // System Green
    '#007AFF', // System Blue
    '#5856D6', // System Indigo
    '#AF52DE'  // System Purple
];

function hashStringToIndex(str, modulo) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h) % modulo;
}

function pickColorForKey(key) {
    return earthPalette[hashStringToIndex(key, earthPalette.length)];
}

// コントラスト判定（テキスト色決定）
function getContrastingTextColor(hex) {
    if (!hex) return '#000';
    const c = hex.replace('#','');
    const r = parseInt(c.substr(0,2),16);
    const g = parseInt(c.substr(2,2),16);
    const b = parseInt(c.substr(4,2),16);
    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
    return luminance > 0.6 ? '#000' : '#fff';
}

// テンプレートデータの互換処理：既存テンプレートに色情報が無ければ付与
for (const k in templates) {
    if (!Array.isArray(templates[k])) templates[k] = [String(templates[k])];
    if (!templates[k][1]) {
        templates[k][1] = pickColorForKey(k);
    }
}
localStorage.setItem('templates', JSON.stringify(templates));

// モーダル要素の取得
const templateModal = document.querySelector('#templateModal');
const closeButton = document.querySelector('.close-button');
const templateContainer = document.querySelector('#templateContainer');
const editModal = document.querySelector('#editModal');
const closeButtonEdit = document.querySelector('.close-button-edit');
const editDateDisplay = document.querySelector('#editDateDisplay');
const editInput = document.querySelector('#editInput');
const saveEditButton = document.querySelector('#saveEdit');
const splitScheduleButton = document.querySelector('#splitSchedule');

// 追加: テンプレート追加モーダル要素
const addTemplateModal = document.querySelector('#addTemplateModal');
const addTemplateButton = document.querySelector('#addTemplateButton');
const addTemplateButtonInModal = document.querySelector('#addTemplateButtonInModal'); // ← 追加
const addTemplateClose = document.querySelector('.close-button-add');
const newTemplateTitleInput = document.querySelector('#newTemplateTitle');
const newTemplateKeyInput = document.querySelector('#newTemplateKey');
const saveNewTemplateButton = document.querySelector('#saveNewTemplate');

let currentDate = new Date();
let schedules = JSON.parse(localStorage.getItem('schedules')) || {};
let editingScheduleKey = null; // テンプレート選択等で使用する既存変数
// 編集モーダル用: 現在編集中のスロットキーと（あれば）配列内インデックス
let editingSlotKey = null;
let editingIndex = null;
// 選択（ドラッグで複数スロット選択）
let selectedSlotKeys = [];
let isDragging = false;
let dragStartKey = null;

// --------------------------------------------------
// カレンダー（月表示・AM/PM）の描画ロジック
// --------------------------------------------------

/**
 * DateオブジェクトをYYYY-MM-DD形式にフォーマット
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 月表示カレンダーを生成し、表示する
 */
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    currentMonthYearDisplay.textContent = `${year}年 ${month + 1}月`;
    calendarBody.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();

    let row = document.createElement('tr');
    let dayCount = 0;
    let todayRow = null;

    // 今日の日付
    const todayString = formatDate(new Date());

    // 1日の曜日までの空白セルを作成
    for (let i = 0; i < firstDay.getDay(); i++) {
        row.appendChild(document.createElement('td'));
        dayCount++;
    }

    // 日付セルを作成
    for (let day = 1; day <= numDays; day++) {
        const cell = document.createElement('td');
        const dateString = formatDate(new Date(year, month, day));
        
        // 日付番号の追加
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        // AM/PMスロットコンテナ
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'time-slots';
        slotsContainer.appendChild(createTimeSlot(dateString, 'AM', '午前'));
        slotsContainer.appendChild(createTimeSlot(dateString, 'PM', '午後'));
        cell.appendChild(slotsContainer);

        // 今日の日付をハイライト
        if (dateString === todayString) {
            cell.classList.add('today');
            todayRow = row; // 今日を含む行を記録
        }

        row.appendChild(cell);
        dayCount++;

        // 土曜日（6）に達したら新しい行を開始
        if (dayCount % 7 === 0) {
            // 今日を含む行ならクラス追加
            if (todayRow === row) {
                row.classList.add('current-week');
            }
            calendarBody.appendChild(row);
            row = document.createElement('tr');
        }
    }

    // 最後の行の追加
    if (dayCount % 7 !== 0) {
        while (dayCount % 7 !== 0) {
            row.appendChild(document.createElement('td'));
            dayCount++;
        }
        // 今日を含む行ならクラス追加
        if (todayRow === row) {
            row.classList.add('current-week');
        }
        calendarBody.appendChild(row);
    }
}

/**
 * AM/PMのタイムスロットを作成
 */
function createTimeSlot(dateString, slotType, slotLabel) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const slotKey = `${dateString}-${slotType}`;
    slot.dataset.key = slotKey;

    const schedule = schedules[slotKey];
    if (schedule) {
        // 配列か単一オブジェクトかで描画を分岐
        if (Array.isArray(schedule)) {
            schedule.forEach((item, idx) => {
                const block = document.createElement('div');
                block.className = 'schedule-block';
                block.textContent = item.title || '';
                if (item.template && templates[item.template] && templates[item.template][1]) {
                    const color = templates[item.template][1];
                    block.style.backgroundColor = color;
                    block.style.color = getContrastingTextColor(color);
                }

                // ダブルクリックで個別編集
                block.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    openEditModal(slotKey, item.title || '', idx);
                });

                slot.appendChild(block);
            });
        } else {
            // 単一オブジェクト
            const block = document.createElement('div');
            block.className = 'schedule-block';
            block.textContent = schedule.title || '';
            // template キーがあればテンプレートの色を使う
            if (schedule.template && templates[schedule.template] && templates[schedule.template][1]) {
                const color = templates[schedule.template][1];
                block.style.backgroundColor = color;
                block.style.color = getContrastingTextColor(color);
            }

            // ダブルクリックで編集
            block.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                openEditModal(slotKey, schedule.title || '', null);
            });

            slot.appendChild(block);
        }
    } else {
        // 空きスロットはクリックでテンプレート選択（単体）
        slot.addEventListener('click', (e) => {
            // クリックは単一選択として扱う
            clearSelection();
            selectedSlotKeys = [slotKey];
            editingScheduleKey = null;
            templateModal.style.display = 'block';
            e.stopPropagation();
        });

        // ドラッグで複数スロット選択: mousedown で開始、mouseover で追加、mouseup で確定
        slot.addEventListener('mousedown', (e) => {
            e.preventDefault(); // テキスト選択防止
            isDragging = true;
            dragStartKey = slotKey;
            clearSelection();
            addToSelection(slotKey);
        });

        slot.addEventListener('mouseover', () => {
            if (!isDragging) return;
            addToSelection(slotKey);
        });

        const label = document.createElement('span');
        label.textContent = slotLabel;
        slot.appendChild(label);
    }

    // 描画時に既に選択されているスロットなら selected クラスを付与
    if (selectedSlotKeys.includes(slotKey)) {
        slot.classList.add('selected');
    }

    return slot;
}

// 選択操作ユーティリティ
function addToSelection(slotKey) {
    if (!selectedSlotKeys.includes(slotKey)) {
        selectedSlotKeys.push(slotKey);
    }
    // 再描画の代わりに直接DOMを更新して視覚フィードバック
    const el = document.querySelector(`.slot[data-key="${slotKey}"]`);
    if (el) el.classList.add('selected');
}

function clearSelection() {
    selectedSlotKeys.forEach(k => {
        const el = document.querySelector(`.slot[data-key="${k}"]`);
        if (el) el.classList.remove('selected');
    });
    selectedSlotKeys = [];
}

// --------------------------------------------------
// スケジュール管理ロジック
// --------------------------------------------------

/**
 * 予定を登録する
 */
function saveSchedule(slotKey, title, templateKey) {
    if (!title.trim()) return;
    // 単一スロットは従来通りオブジェクトで保存
    schedules[slotKey] = {
        title: title.trim(),
        template: templateKey || null
    };
    localStorage.setItem('schedules', JSON.stringify(schedules));
    renderCalendar();
}

/**
 * 予定を削除する
 */
function deleteSchedule(slotKey) {
    // 単一削除：slotKey の予定を全削除
    if (confirm('このブロックの予定を即座に削除しますか？')) {
        delete schedules[slotKey];
        localStorage.setItem('schedules', JSON.stringify(schedules));
        renderCalendar();
    }
}

// index が渡された場合、配列中の要素を削除
function deleteSchedule(slotKey, index, skipConfirm = false) {
    if (typeof index === 'number') {
        if (!Array.isArray(schedules[slotKey])) return;
        if (!skipConfirm && !confirm('このアイテムを削除しますか？')) return;
        schedules[slotKey].splice(index, 1);
        if (schedules[slotKey].length === 0) delete schedules[slotKey];
        localStorage.setItem('schedules', JSON.stringify(schedules));
        renderCalendar();
    } else {
        // index が指定されていない場合は全削除
        if (skipConfirm || confirm('このブロックの予定を即座に削除しますか？')) {
            delete schedules[slotKey];
            localStorage.setItem('schedules', JSON.stringify(schedules));
            renderCalendar();
        }
    }
}

/**
 * 予定編集モーダルを開く
 */
function openEditModal(slotKey, content) {
    // slotKey は YYYY-MM-DD-AM 形式。content は編集対象のタイトル。
    const [dateString, slotType] = slotKey.split('-');

    editingSlotKey = slotKey;
    // 編集対象の配列インデックスが渡されることもあるが openEditModal の呼び出し側で渡す
    // この関数 may receive a 3rd arg index; handle via arguments
    const idx = (arguments.length >= 3) ? arguments[2] : null;
    editingIndex = (typeof idx === 'number') ? idx : null;

    // editingScheduleKey はテンプレート適用のための従来変数を更新（配列編集時は null にする）
    editingScheduleKey = null;

    editInput.value = content;
    editModal.style.display = 'block';
    editInput.focus();
}

/**
 * 編集内容を保存する
 */
function saveEdit() {
    const newContent = editInput.value.trim();
    if (!editingSlotKey || !newContent) {
        alert('内容を入力してください。');
        return;
    }

    const cur = schedules[editingSlotKey];
    if (Array.isArray(cur)) {
        // 配列内要素の更新
        if (editingIndex === null || typeof editingIndex !== 'number') {
            alert('編集対象が不明です。');
            return;
        }
        const old = cur[editingIndex] || {};
        cur[editingIndex] = {
            title: newContent,
            template: old.template || null
        };
        schedules[editingSlotKey] = cur;
    } else {
        // 単一オブジェクトの場合
        const old = cur || {};
        schedules[editingSlotKey] = {
            title: newContent,
            template: old.template || null
        };
    }
    localStorage.setItem('schedules', JSON.stringify(schedules));

    editModal.style.display = 'none';
    renderCalendar();
}

// 分割処理: 現在の編集対象を分割して新しい項目を追加する
function splitSchedule() {
    if (!editingSlotKey) return;

    const cur = schedules[editingSlotKey];
    // 編集対象が配列であれば、editingIndex が指定されているはず
    if (Array.isArray(cur)) {
        // 配列中の要素を分割（現在の要素の直後に新しい空要素を挿入）
        const idx = (typeof editingIndex === 'number') ? editingIndex : cur.length - 1;
        const old = cur[idx] || {};
        const newEntry = { title: '', template: old.template || null };
        cur.splice(idx + 1, 0, newEntry);
        schedules[editingSlotKey] = cur;
    } else {
        // 単一オブジェクトの場合、配列に変換して2つにする
        const old = cur || {};
        schedules[editingSlotKey] = [
            { title: old.title || '', template: old.template || null },
            { title: '', template: old.template || null }
        ];
    }

    localStorage.setItem('schedules', JSON.stringify(schedules));
    // 新しく追加したエントリを即座に編集できるようにモーダルを開く
    let newIndex = null;
    if (Array.isArray(schedules[editingSlotKey])) {
        // 配列に変換した場合や配列に挿入した場合、新しい要素は最後または直後に追加されている
        if (Array.isArray(cur)) {
            // 元が配列（挿入）なら idx+1 が新しいインデックス
            newIndex = (typeof editingIndex === 'number') ? editingIndex + 1 : schedules[editingSlotKey].length - 1;
        } else {
            // 単一から配列に変換した場合、新しい要素はインデックス1
            newIndex = 1;
        }
    }
    renderCalendar();

    if (newIndex !== null) {
        // 分割後はテンプレート選択ではなく、直接タイトル入力ダイアログを出す
        try {
            const defaultTitle = (schedules[editingSlotKey] && schedules[editingSlotKey][newIndex]) ? (schedules[editingSlotKey][newIndex].title || '') : '';
            const input = window.prompt('新しい予定のタイトルを入力してください（キャンセルで空のまま）:', defaultTitle);
            if (input !== null) {
                const v = input.trim();
                if (Array.isArray(schedules[editingSlotKey])) {
                    schedules[editingSlotKey][newIndex].title = v;
                } else {
                    // 万が一配列になっていなければオブジェクトとして保存
                    schedules[editingSlotKey] = { title: v, template: null };
                }
                localStorage.setItem('schedules', JSON.stringify(schedules));
                renderCalendar();
            }
        } catch (e) {
            console.error('splitSchedule prompt error', e);
        }
        // 編集対象をクリア
        editingIndex = null;
        editingSlotKey = null;
    } else {
        // 配列でない（安全策）: 単に閉じる
        editModal.style.display = 'none';
    }
}


// --------------------------------------------------
// テンプレート機能ロジック
// --------------------------------------------------

/**
 * テンプレートカードを動的に生成し、モーダルに挿入する
 */
function createTemplateCards() {
    templateContainer.innerHTML = '';
    
    for (const key in templates) {
        const title = templates[key][0];
        const color = templates[key][1] || pickColorForKey(key);
        
        const card = document.createElement('div');
        card.className = `template-card`;
        card.dataset.key = key;
        card.style.backgroundColor = color;
        card.style.borderColor = color;
        card.style.color = getContrastingTextColor(color);

        // タイトル
        const h = document.createElement('h4');
        h.textContent = title;
        card.appendChild(h);

        // 削除ボタン（右上の×）
        const delBtn = document.createElement('button');
        delBtn.className = 'template-delete-btn';
        delBtn.type = 'button';
        delBtn.title = 'テンプレートを削除';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // カードクリック（適用）を防ぐ
            if (!confirm(`テンプレート「${title}」を削除しますか？`)) return;

            // テンプレートを削除
            delete templates[key];
            localStorage.setItem('templates', JSON.stringify(templates));

            // UIを更新（テンプレート選択モーダルは開いたままにする）
            createTemplateCards();
        });
        card.appendChild(delBtn);

        // カードクリックでテンプレート適用
        card.addEventListener('click', () => {
            // 選択範囲があればそれら全てに適用
            if (selectedSlotKeys.length > 0) {
                selectedSlotKeys.forEach(slotKey => {
                    saveSchedule(slotKey, title, key);
                });
                templateModal.style.display = 'none';
                clearSelection();
                return;
            }

            // 単体選択（従来の動作）
            if (editingScheduleKey) {
                saveSchedule(editingScheduleKey, title, key);
                templateModal.style.display = 'none';
            }
        });

        templateContainer.appendChild(card);
    }
}

// --------------------------------------------------
// 新規テンプレート追加ロジック
// --------------------------------------------------

/**
 * タイトルから安全なキーを生成（重複があれば末尾に番号を付与）
 */
function generateKeyFromTitle(title) {
    let base = title.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]/g, '');
    if (!base) base = 'tpl';
    let key = base;
    let i = 1;
    while (templates[key]) {
        key = `${base}_${i++}`;
    }
    return key;
}

/**
 * 新しいテンプレートを保存
 */
function saveNewTemplate() {
    const title = newTemplateTitleInput.value.trim();
    let key = newTemplateKeyInput.value.trim();

    if (!title) {
        alert('テンプレート名を入力してください。');
        return;
    }

    if (!key) {
        key = generateKeyFromTitle(title);
    } else {
        key = key.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
        if (!key) key = generateKeyFromTitle(title);
        if (templates[key]) key = generateKeyFromTitle(key);
    }

    // 追加（タイトル + カラー）
    const color = pickColorForKey(key);
    templates[key] = [title, color];
    localStorage.setItem('templates', JSON.stringify(templates));

    // UI更新
    createTemplateCards();
    addTemplateModal.style.display = 'none';
    newTemplateTitleInput.value = '';
    newTemplateKeyInput.value = '';
}

// --------------------------------------------------
// イベントリスナー & 初期処理
// --------------------------------------------------

// 月移動ボタン
prevMonthButton.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthButton.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// モーダル閉じる
closeButton.addEventListener('click', () => { templateModal.style.display = 'none'; clearSelection(); });
window.addEventListener('click', (event) => { if (event.target === templateModal) { templateModal.style.display = 'none'; clearSelection(); } });

// 編集モーダル
closeButtonEdit.addEventListener('click', () => { editModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === editModal) { editModal.style.display = 'none'; } });
saveEditButton.addEventListener('click', saveEdit);
// split ボタンはモーダル内にあるため、確実に存在しない場合がある。
// そのためここで再クエリしてイベントを付与する（存在すれば複数回の登録は無視する）。
const _splitBtn = splitScheduleButton || document.querySelector('#splitSchedule');
if (_splitBtn) {
    try { _splitBtn.removeEventListener('click', splitSchedule); } catch (e) {}
    _splitBtn.addEventListener('click', splitSchedule);
}

// 編集モーダル内の削除ボタン
const deleteScheduleInModalButton = document.querySelector('#deleteScheduleInModal');
if (deleteScheduleInModalButton) {
    deleteScheduleInModalButton.addEventListener('click', () => {
        if (editingSlotKey !== null) {
            deleteSchedule(editingSlotKey, editingIndex, true);
            editModal.style.display = 'none';
        }
    });
}

// テンプレート追加モーダル（既存ボタンとモーダル内ボタンの両方をサポート）
function openAddTemplateModal() {
    newTemplateTitleInput.value = '';
    newTemplateKeyInput.value = '';
    addTemplateModal.style.display = 'block';
    newTemplateTitleInput.focus();
}

if (addTemplateButton) addTemplateButton.addEventListener('click', openAddTemplateModal);
if (addTemplateButtonInModal) addTemplateButtonInModal.addEventListener('click', () => {
    // テンプレート選択モーダルを閉じて追加モーダルを開く
    templateModal.style.display = 'none';
    clearSelection();
    openAddTemplateModal();
});

addTemplateClose.addEventListener('click', () => { addTemplateModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === addTemplateModal) { addTemplateModal.style.display = 'none'; } });
saveNewTemplateButton.addEventListener('click', saveNewTemplate);

// グローバル: マウスアップでドラッグ選択を終了
window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        isDragging = false;
        dragStartKey = null;
        // 選択範囲があればテンプレート適用モーダルを開く
        if (selectedSlotKeys.length > 0) {
            editingScheduleKey = null;
            templateModal.style.display = 'block';
        }
    }
});

// 現在時刻の更新
function updateCurrentTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    currentTimeDisplay.textContent = `現在時刻 ${hh}:${mm}:${ss}`;
}
setInterval(updateCurrentTime, 1000);
updateCurrentTime();

// 初期表示
renderCalendar();
createTemplateCards(); // テンプレートカードを一度生成