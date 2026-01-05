const COLS = 6
const ROWS = 5
const COLORS = ['red','blue','green','yellow','purple','heart'] as const

type Color = typeof COLORS[number]
type Cell = number // index of COLORS, -1 empty

function randInt(max: number) { return Math.floor(Math.random() * max) }
function randColorIndex(): number { return randInt(COLORS.length) }

function makeGrid(): Cell[][] {
  const g: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => -1))
  
  // 逐格填入顏色，確保不會產生三連珠
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const forbidden = new Set<number>()
      
      // 檢查水平方向：如果左邊兩格同色，禁止該顏色
      if (c >= 2 && g[r][c-1] === g[r][c-2] && g[r][c-1] >= 0) {
        forbidden.add(g[r][c-1])
      }
      
      // 檢查垂直方向：如果上面兩格同色，禁止該顏色
      if (r >= 2 && g[r-1][c] === g[r-2][c] && g[r-1][c] >= 0) {
        forbidden.add(g[r-1][c])
      }
      
      // 從允許的顏色中隨機選擇
      const allowed = COLORS.map((_, i) => i).filter(i => !forbidden.has(i))
      g[r][c] = allowed[randInt(allowed.length)]
    }
  }
  
  return g
}

function cloneGrid(g: Cell[][]): Cell[][] { return g.map(r => r.slice()) }

// 粒子特效
function createParticles(row: number, col: number, color: string, combo: number, isBigMatch: boolean = false) {
  if (!cachedBoard) return
  const boardRect = cachedBoard.getBoundingClientRect()
  const cellW = boardRect.width / COLS
  const cellH = boardRect.height / ROWS
  const centerX = boardRect.left + (col + 0.5) * cellW
  const centerY = boardRect.top + (row + 0.5) * cellH
  
  // 粒子數量根據 combo 增加，大消除時更多
  const baseCount = isBigMatch ? 12 : 6
  const particleCount = Math.min(baseCount + combo * 2, isBigMatch ? 30 : 20)
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div')
    particle.className = `particle ${color}${isBigMatch ? ' big-match' : ''}`
    
    // 隨機角度和距離，大消除時距離更遠
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5
    const baseDistance = isBigMatch ? 60 : 40
    const distance = baseDistance + Math.random() * (isBigMatch ? 60 : 40) + combo * 5
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    
    particle.style.left = `${centerX}px`
    particle.style.top = `${centerY}px`
    particle.style.setProperty('--dx', `${dx}px`)
    particle.style.setProperty('--dy', `${dy}px`)
    
    document.body.appendChild(particle)
    setTimeout(() => particle.remove(), isBigMatch ? 700 : 500)
  }
  
  // 大消除時額外產生爆炸光環
  if (isBigMatch) {
    const ring = document.createElement('div')
    ring.className = `explosion-ring ${color}`
    ring.style.left = `${centerX}px`
    ring.style.top = `${centerY}px`
    document.body.appendChild(ring)
    setTimeout(() => ring.remove(), 500)
  }
}

// 全域 DOM 快取
let cachedBoard: HTMLElement | null = null
let cachedOrbs: Map<string, HTMLElement> = new Map()

function render(root: HTMLElement, state: GameState) {
  pruneTrail(state)

  // 初次渲染：建立 UI 和棋盤框架
  if (!cachedBoard || !root.contains(cachedBoard)) {
    root.innerHTML = ''
    cachedOrbs.clear()

    const ui = document.createElement('div')
    ui.className = 'ui'
    const score = document.createElement('div')
    score.className = 'score'
    score.id = 'score-display'
    score.textContent = `分數：${state.score}　連擊：${state.lastCombo}`
    
    const reset = document.createElement('button')
    reset.textContent = '重置棋盤'
    reset.addEventListener('click', () => {
      state.grid = makeGrid()
      state.lastCombo = 0
      state.score = 0
      state.dragTimeRemaining = state.dragTimeLimit
      cachedOrbs.clear()
      cachedBoard = null
      render(root, state)
    })
    ui.append(score, reset)
    root.appendChild(ui)

    const hint = document.createElement('div')
    hint.className = 'hint'
    hint.textContent = '按住一顆珠子拖曳路徑推動其它珠子，放開後自動消除。'
    root.appendChild(hint)

    const timerBar = document.createElement('div')
    timerBar.className = 'timer-bar'
    timerBar.id = 'timer-bar'
    const timerFill = document.createElement('div')
    timerFill.className = 'timer-fill'
    timerFill.id = 'timer-fill'
    timerBar.appendChild(timerFill)
    root.appendChild(timerBar)

    const board = document.createElement('div')
    board.className = 'board'
    root.appendChild(board)
    cachedBoard = board

    // Combo 顯示
    const comboDisplay = document.createElement('div')
    comboDisplay.className = 'combo-display'
    comboDisplay.id = 'combo-display'
    root.appendChild(comboDisplay)

    // 建立格子
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div')
        cell.className = 'cell'
        cell.dataset.row = String(r)
        cell.dataset.col = String(c)
        board.appendChild(cell)
      }
    }

    attachPointer(board, state, () => render(root, state))
  }

  // 更新分數顯示
  const scoreEl = document.getElementById('score-display')
  if (scoreEl) {
    scoreEl.textContent = `分數：${state.score}　連擊：${state.lastCombo}`
  }
  
  // 更新計時橫條
  const timerFill = document.getElementById('timer-fill')
  const timerBar = document.getElementById('timer-bar')
  if (timerFill && timerBar) {
    const percent = (state.dragTimeRemaining / state.dragTimeLimit) * 100
    timerFill.style.width = `${percent}%`
    timerBar.classList.toggle('warning', state.dragging && state.dragTimeRemaining <= 2000)
    timerBar.classList.toggle('active', state.dragging)
  }

  // 更新格子的 path 高亮
  const cells = cachedBoard.querySelectorAll('.cell')
  cells.forEach((cell) => {
    const r = parseInt((cell as HTMLElement).dataset.row || '0', 10)
    const c = parseInt((cell as HTMLElement).dataset.col || '0', 10)
    if (state.dragPath && state.dragPath.has(`${r},${c}`)) {
      cell.classList.add('path')
    } else {
      cell.classList.remove('path')
    }
  })

  // 差異更新珠子（拖曳中使用輕量更新）
  updateOrbs(state, true)
}

function updateOrbs(state: GameState, skipDuringDrag = false) {
  if (!cachedBoard) return
  
  // 拖曳中只更新 class 狀態，不要移動或建立珠子
  if (skipDuringDrag && state.dragging) {
    cachedOrbs.forEach((orb, key) => {
      const [r, c] = key.split(',').map(Number)
      orb.classList.toggle('dragging', state.dragRow === r && state.dragCol === c)
      orb.classList.toggle('trail', isTrailCell(state, r, c))
    })
    return
  }

  const currentKeys = new Set<string>()

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = state.grid[r][c]
      if (v < 0) continue

      const key = `${r},${c}`
      currentKeys.add(key)

      let orb = cachedOrbs.get(key)
      const cell = cachedBoard.children[r * COLS + c] as HTMLElement

      if (!orb) {
        // 建立新珠子
        orb = document.createElement('div')
        orb.className = `orb ${COLORS[v]}`
        cell.appendChild(orb)
        cachedOrbs.set(key, orb)
      } else {
        // 更新珠子顏色（只更新顏色 class，不要清除整個 className）
        COLORS.forEach(color => orb!.classList.remove(color))
        orb.classList.add(COLORS[v])
        // 確保珠子在正確的 cell 裡（但如果正在滑動中就不要移動）
        if (orb.parentElement !== cell && !orb.style.transition) {
          cell.appendChild(orb)
        }
      }

      // 更新珠子狀態
      orb.classList.toggle('dragging', state.dragging && state.dragRow === r && state.dragCol === c)
      orb.classList.toggle('matched', !!(state.matched && state.matched[r][c]))
      orb.classList.toggle('matched-big', !!(state.matchedBig && state.matchedBig[r][c]))
      orb.classList.toggle('enhanced', state.enhanced.has(key))
      orb.classList.toggle('trail', isTrailCell(state, r, c))

      // 下落動畫
      const fallDist = state.fallDistances.get(key)
      if (state.falling && fallDist && fallDist > 0) {
        orb.classList.add('falling')
        orb.style.setProperty('--fall-distance', String(fallDist))
      } else {
        orb.classList.remove('falling')
        orb.style.removeProperty('--fall-distance')
      }
    }
  }

  // 移除不存在的珠子
  cachedOrbs.forEach((orb, key) => {
    if (!currentKeys.has(key)) {
      orb.remove()
      cachedOrbs.delete(key)
    }
  })
}

function attachPointer(board: HTMLElement, state: GameState, onUpdate: () => void) {
  const rect = () => board.getBoundingClientRect()

  function pickCellFromPoint(x: number, y: number) {
    const r = rect()
    const gx = Math.min(Math.max(x - r.left, 0), r.width)
    const gy = Math.min(Math.max(y - r.top, 0), r.height)
    const cw = r.width / COLS
    const ch = r.height / ROWS
    const col = Math.min(Math.max(Math.floor(gx / cw), 0), COLS - 1)
    const row = Math.min(Math.max(Math.floor(gy / ch), 0), ROWS - 1)
    return { row, col }
  }
  
  function updateDraggedOrbPosition(board: HTMLElement, state: GameState) {
    if (!state.draggedOrb || state.pointerX === undefined || state.pointerY === undefined) return
    if (state.dragRow === undefined || state.dragCol === undefined) return
    
    const r = rect()
    const cellW = r.width / COLS
    const cellH = r.height / ROWS
    
    // 計算珠子所在格子的中心位置
    const cellCenterX = r.left + (state.dragCol + 0.5) * cellW
    const cellCenterY = r.top + (state.dragRow + 0.5) * cellH
    
    // 計算手指相對於格子中心的偏移
    const offsetX = state.pointerX - cellCenterX
    const offsetY = state.pointerY - cellCenterY
    
    // 套用偏移到珠子
    state.draggedOrb.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1.15)`
  }

  function isAdjacent(a: {row:number,col:number}, b: {row:number,col:number}) {
    const dr = Math.abs(a.row - b.row)
    const dc = Math.abs(a.col - b.col)
    // 允許 8 方向移動（包含斜向）
    return dr <= 1 && dc <= 1 && (dr + dc > 0)
  }

  function onPointerDown(ev: PointerEvent) {
    if (state.animating) return
    const t = ev.target as HTMLElement
    const cellEl = t.closest('.cell') as HTMLElement | null
    let start: {row:number,col:number}
    if (cellEl && cellEl.dataset.row && cellEl.dataset.col) {
      const row = parseInt(cellEl.dataset.row, 10)
      const col = parseInt(cellEl.dataset.col, 10)
      start = { row, col }
    } else {
      start = pickCellFromPoint(ev.clientX, ev.clientY)
    }
    state.dragging = true
    const sr = start.row;
    const sc = start.col;
    state.dragRow = sr;
    state.dragCol = sc;
    const picked = state.grid[sr][sc];
    state.dragValue = picked;
    state.dragPath = new Set([`${sr},${sc}`]);
    (board as HTMLElement).setPointerCapture(ev.pointerId);
    
    // 預熱震動 API（解鎖瀏覽器安全限制）
    if (navigator.vibrate) {
      navigator.vibrate(1)
    }
    
    // 記錄手指位置和拖曳珠子
    state.pointerX = ev.clientX
    state.pointerY = ev.clientY
    const dragOrbKey = `${sr},${sc}`
    state.draggedOrb = cachedOrbs.get(dragOrbKey)
    if (state.draggedOrb) {
      state.draggedOrb.classList.add('floating')
      updateDraggedOrbPosition(board, state)
    }
    
    // 重置計時器（但不啟動，等第一次移動才開始）
    state.dragStartTime = undefined
    state.dragTimeRemaining = state.dragTimeLimit
    if (state.timerInterval) {
      clearInterval(state.timerInterval)
      state.timerInterval = undefined
    }
    
    onUpdate();
  }
  
  function forceRelease() {
    if (!state.dragging) return
    state.dragging = false;
    state.dragRow = state.dragCol = undefined;
    state.dragValue = -1;
    state.dragPath = undefined;
    state.dragTimeRemaining = state.dragTimeLimit
    
    // 清理浮動珠子
    if (state.draggedOrb) {
      state.draggedOrb.classList.remove('floating')
      state.draggedOrb = undefined
    }
    state.pointerX = undefined
    state.pointerY = undefined
    
    // 清理所有珠子的 transform 和 transition
    cachedOrbs.forEach((orb) => {
      orb.style.transition = ''
      orb.style.transform = ''
    })
    
    animateResolveChain(state, onUpdate)
  }

  function onPointerMove(ev: PointerEvent) {
    if (state.animating) return
    if (!state.dragging || state.dragRow === undefined || state.dragCol === undefined) return
    
    // 更新手指位置，讓珠子跟隨
    state.pointerX = ev.clientX
    state.pointerY = ev.clientY
    updateDraggedOrbPosition(board, state)
    
    const cur = { row: state.dragRow, col: state.dragCol }
    const next = pickCellFromPoint(ev.clientX, ev.clientY)
    if (next.row === cur.row && next.col === cur.col) return
    if (!isAdjacent(cur, next)) return
    
    // 第一次移動時啟動計時器
    if (!state.dragStartTime) {
      state.dragStartTime = Date.now()
      state.timerInterval = window.setInterval(() => {
        if (!state.dragging) {
          clearInterval(state.timerInterval)
          return
        }
        const elapsed = Date.now() - (state.dragStartTime || Date.now())
        state.dragTimeRemaining = Math.max(0, state.dragTimeLimit - elapsed)
        onUpdate()
        
        // 時間到，強制放開
        if (state.dragTimeRemaining <= 0) {
          clearInterval(state.timerInterval)
          forceRelease()
        }
      }, 50)
    }
    
    // 取得兩個珠子的 DOM 元素（交換前）
    const curKey = `${cur.row},${cur.col}`
    const nextKey = `${next.row},${next.col}`
    const dragOrb = cachedOrbs.get(curKey)    // 正在拖曳的珠子（在 cur）
    const pushedOrb = cachedOrbs.get(nextKey)  // 被推開的珠子（在 next）
    
    // 取得兩個 cell
    const curCell = cachedBoard!.children[cur.row * COLS + cur.col] as HTMLElement
    const nextCell = cachedBoard!.children[next.row * COLS + next.col] as HTMLElement
    
    // 交換 grid 資料
    const temp = state.grid[next.row][next.col]
    state.grid[next.row][next.col] = state.dragValue
    state.grid[cur.row][cur.col] = temp
    state.dragRow = next.row
    state.dragCol = next.col
    
    // 交換強化珠狀態
    const curEnhanced = state.enhanced.has(curKey)
    const nextEnhanced = state.enhanced.has(nextKey)
    state.enhanced.delete(curKey)
    state.enhanced.delete(nextKey)
    if (curEnhanced) state.enhanced.set(nextKey, true)
    if (nextEnhanced) state.enhanced.set(curKey, true)
    
    // 震動回饋（輕微）
    if (navigator.vibrate) {
      navigator.vibrate(15)
    }
    
    // 移動被推開的珠子到 cur cell，帶滑動動畫
    if (pushedOrb) {
      // 計算偏移：從 cur cell 的角度看，next cell 在哪個方向
      const offsetX = (next.col - cur.col) * 100
      const offsetY = (next.row - cur.row) * 100
      
      // 先移動到新 cell，並設定起始位置（視覺上還在原處）
      pushedOrb.style.transition = 'none'
      pushedOrb.style.transform = `translate(${offsetX}%, ${offsetY}%)`
      curCell.appendChild(pushedOrb)
      cachedOrbs.set(curKey, pushedOrb)
      
      // 強制重繪後播放動畫
      void pushedOrb.offsetWidth
      pushedOrb.style.transition = 'transform 100ms ease-out'
      pushedOrb.style.transform = 'translate(0, 0)'
    }
    
    // 移動拖曳中的珠子到 next cell（無動畫，跟著手指）
    if (dragOrb) {
      dragOrb.style.transition = 'none'
      dragOrb.style.transform = 'translate(0, 0)'
      nextCell.appendChild(dragOrb)
      cachedOrbs.set(nextKey, dragOrb)
    }
    
    // 路徑與尾跡
    state.dragPath?.add(`${next.row},${next.col}`);
    const now = Date.now();
    state.trail.push({ row: cur.row, col: cur.col, until: now + 220 });
    state.trail.push({ row: next.row, col: next.col, until: now + 220 });
    onUpdate();
  }

  function onPointerUp() {
    if (!state.dragging) return
    
    // 停止計時器
    if (state.timerInterval) {
      clearInterval(state.timerInterval)
      state.timerInterval = undefined
    }
    state.dragTimeRemaining = state.dragTimeLimit
    
    state.dragging = false;
    state.dragRow = state.dragCol = undefined;
    state.dragValue = -1;
    state.dragPath = undefined;
    
    // 清理浮動珠子
    if (state.draggedOrb) {
      state.draggedOrb.classList.remove('floating')
      state.draggedOrb = undefined
    }
    state.pointerX = undefined
    state.pointerY = undefined
    
    // 清理所有珠子的 transform 和 transition
    cachedOrbs.forEach((orb) => {
      orb.style.transition = ''
      orb.style.transform = ''
    })
    
    animateResolveChain(state, onUpdate)
  }

  board.onpointerdown = onPointerDown
  board.onpointermove = onPointerMove
  board.onpointerup = onPointerUp
  board.onpointercancel = onPointerUp
}

function findMatches(g: Cell[][]) {
  const mark: boolean[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    let c = 0
    while (c < COLS) {
      const v = g[r][c]
      if (v < 0) { c++; continue }
      let len = 1
      while (c + len < COLS && g[r][c + len] === v) len++
      if (len >= 3) {
        for (let k = 0; k < len; k++) mark[r][c + k] = true
      }
      c += len
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    let r = 0
    while (r < ROWS) {
      const v = g[r][c]
      if (v < 0) { r++; continue }
      let len = 1
      while (r + len < ROWS && g[r + len][c] === v) len++
      if (len >= 3) {
        for (let k = 0; k < len; k++) mark[r + k][c] = true
      }
      r += len
    }
  }
  // count combos by connected components of marked cells
  let combos = 0
  const vis: boolean[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (mark[r][c] && !vis[r][c]) {
        combos++
        const q: Array<[number, number]> = [[r,c]]
        vis[r][c] = true
        while (q.length) {
          const head = q.shift()
          if (!head) break
          const [y,x] = head
          for (const [dy,dx] of dirs) {
            const ny = y + dy, nx = x + dx
            if (ny>=0 && ny<ROWS && nx>=0 && nx<COLS && mark[ny][nx] && !vis[ny][nx]) {
              vis[ny][nx] = true
              q.push([ny,nx])
            }
          }
        }
      }
    }
  }
  return { mark, combos }
}

function countMarked(mark: boolean[][]) {
  let n = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (mark[r][c]) n++
    }
  }
  return n
}

function groupsByColor(grid: Cell[][], mark: boolean[][]): Array<Array<[number, number]>> {
  // 使用 flood fill 找出每個獨立的連通區塊
  const visited: boolean[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  const groups: Array<Array<[number, number]>> = []
  
  function floodFill(startR: number, startC: number, color: number): Array<[number, number]> {
    const group: Array<[number, number]> = []
    const stack: Array<[number, number]> = [[startR, startC]]
    
    while (stack.length > 0) {
      const [r, c] = stack.pop()!
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue
      if (visited[r][c]) continue
      if (!mark[r][c]) continue
      if (grid[r][c] !== color) continue
      
      visited[r][c] = true
      group.push([r, c])
      
      // 只檢查上下左右四個方向（不包含斜向）
      stack.push([r - 1, c])
      stack.push([r + 1, c])
      stack.push([r, c - 1])
      stack.push([r, c + 1])
    }
    
    return group
  }
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (mark[r][c] && !visited[r][c] && grid[r][c] >= 0) {
        const group = floodFill(r, c, grid[r][c])
        if (group.length > 0) {
          groups.push(group)
        }
      }
    }
  }
  
  return groups
}

function removeMarked(g: Cell[][], mark: boolean[][]) {
  let removed = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (mark[r][c]) { g[r][c] = -1; removed++ }
    }
  }
  return removed
}

function applyGravity(g: Cell[][]): Map<string, number> {
  const fallMap = new Map<string, number>()
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = g[r][c]
      if (v >= 0) {
        const distance = writeRow - r
        if (distance > 0) {
          g[writeRow][c] = v
          g[r][c] = -1
          // 記錄目標位置需要下落的格數
          fallMap.set(`${writeRow},${c}`, distance)
        }
        writeRow--
      }
    }
    // 頂部補新珠子並記錄下落距離
    for (let r = writeRow; r >= 0; r--) {
      g[r][c] = randColorIndex()
      // 新珠子從頂部外面掉下來
      fallMap.set(`${r},${c}`, writeRow + 1 - r + (ROWS - 1 - writeRow))
    }
  }
  return fallMap
}

// 支援強化珠的重力函數
function applyGravityWithEnhanced(
  g: Cell[][],
  enhanced: Map<string, boolean>,
  pendingEnhanced: Array<{ col: number; colorIndex: number }>
): Map<string, number> {
  const fallMap = new Map<string, number>()
  
  // 追蹤每列原本的強化珠位置，跟著珠子一起移動
  const oldEnhanced = new Map(enhanced)
  enhanced.clear()
  
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1
    
    // 先移動現有珠子
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = g[r][c]
      if (v >= 0) {
        const distance = writeRow - r
        const oldKey = `${r},${c}`
        const newKey = `${writeRow},${c}`
        
        if (distance > 0) {
          g[writeRow][c] = v
          g[r][c] = -1
          fallMap.set(newKey, distance)
        }
        
        // 如果原位置是強化珠，移動到新位置
        if (oldEnhanced.has(oldKey)) {
          enhanced.set(newKey, true)
        }
        
        writeRow--
      }
    }
    
    // 檢查這一列是否有待產生的強化珠
    const pendingForCol = pendingEnhanced.filter(p => p.col === c)
    
    // 頂部補新珠子並記錄下落距離
    let newOrbIndex = 0
    for (let r = writeRow; r >= 0; r--) {
      const newKey = `${r},${c}`
      
      // 檢查是否應該是強化珠
      if (newOrbIndex < pendingForCol.length) {
        // 這顆是強化珠
        g[r][c] = pendingForCol[newOrbIndex].colorIndex
        enhanced.set(newKey, true)
        newOrbIndex++
      } else {
        g[r][c] = randColorIndex()
      }
      
      // 新珠子從頂部外面掉下來
      fallMap.set(newKey, writeRow + 1 - r + (ROWS - 1 - writeRow))
    }
  }
  return fallMap
}

function refill(g: Cell[][]) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g[r][c] < 0) g[r][c] = randColorIndex()
    }
  }
}

function resolveOnce(g: Cell[][]) {
  const { mark, combos } = findMatches(g)
  const removed = removeMarked(g, mark)
  if (removed === 0) return { removed, combos: 0 }
  applyGravity(g)
  refill(g)
  return { removed, combos }
}

function resolveAll(state: GameState) {
  let totalRemoved = 0
  let totalCombos = 0
  const work = cloneGrid(state.grid)
  while (true) {
    const { removed, combos } = resolveOnce(work)
    if (removed === 0) break
    totalRemoved += removed
    totalCombos += combos
  }
  state.grid = work
  return { removed: totalRemoved, combos: totalCombos }
}

function animateResolveChain(state: GameState, onUpdate: () => void) {
  let totalRemoved = 0
  let totalCombos = 0

  function makeEmptyMark(): boolean[][] {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => false))
  }

  function step() {
    const { mark, combos } = findMatches(state.grid)
    const willRemove = countMarked(mark)
    if (willRemove === 0) {
      state.animating = false
      state.matched = undefined
      state.justRefilled = false
      state.falling = false
      state.lastCombo = totalCombos
      state.score += totalRemoved * 10 + totalCombos * 100
      
      // 隱藏 Combo 顯示
      const comboEl = document.getElementById('combo-display')
      if (comboEl) {
        comboEl.classList.remove('show')
      }
      
      onUpdate()
      return
    }
    state.animating = true
    const groups = groupsByColor(state.grid, mark)
    const groupCount = groups.length  // 本輪的組數
    let gi = 0

    function removeGroup() {
      if (gi >= groups.length) {
        // 本輪結束，累計 combo 數
        totalCombos += groupCount
        
        // 完成本輪逐組消除，執行重力並取得每顆珠子的下落距離
        setTimeout(() => {
          const fallMap = applyGravityWithEnhanced(state.grid, state.enhanced, state.pendingEnhanced)
          state.pendingEnhanced = []  // 清空待產生的強化珠
          state.fallDistances = fallMap
          state.falling = true
          state.matched = undefined
          state.matchedBig = undefined
          onUpdate()
          setTimeout(() => {
            state.falling = false
            state.fallDistances = new Map()
            step()
          }, 500)
        }, 80)
        return
      }
      const g = groups[gi]
      const isBigMatch = g.length >= 5  // 大消除判定（5顆以上）
      const mask = makeEmptyMark()
      const bigMask = makeEmptyMark()
      for (const [r,c] of g) {
        mask[r][c] = true
        if (isBigMatch) bigMask[r][c] = true
      }
      state.matched = mask
      state.matchedBig = isBigMatch ? bigMask : undefined
      
      // 計算當前 combo（使用 totalCombos 累計 + 本輪已消除組數）
      const currentCombo = totalCombos + gi + 1
      
      // 更新 Combo 顯示
      const comboEl = document.getElementById('combo-display')
      if (comboEl) {
        comboEl.textContent = `${currentCombo} Combo`
        comboEl.classList.remove('show')
        void comboEl.offsetWidth  // 強制重繪
        comboEl.classList.add('show')
        
        // 高 combo 時改變顏色
        comboEl.classList.toggle('high-combo', currentCombo >= 5)
        comboEl.classList.toggle('super-combo', currentCombo >= 10)
      }
      
      // Combo 連擊棋盤發光（暫時停用）
      // if (currentCombo >= 3 && cachedBoard) {
      //   cachedBoard.classList.remove('combo-glow', 'high', 'super')
      //   void cachedBoard.offsetWidth  // 強制重繪
      //   cachedBoard.classList.add('combo-glow')
      //   if (currentCombo >= 10) cachedBoard.classList.add('super')
      //   else if (currentCombo >= 5) cachedBoard.classList.add('high')
      //   setTimeout(() => {
      //     cachedBoard?.classList.remove('combo-glow', 'high', 'super')
      //   }, 300)
      // }
      
      // 消除粒子特效
      const color = state.grid[g[0][0]][g[0][1]] >= 0 ? COLORS[state.grid[g[0][0]][g[0][1]]] : 'white'
      for (const [r, c] of g) {
        createParticles(r, c, color, currentCombo, isBigMatch)
      }
      
      // 震動回饋（根據消除數量調整震動強度，大消除更強）
      if (navigator.vibrate) {
        const vibrationDuration = isBigMatch 
          ? Math.min(80 + g.length * 15, 200)
          : Math.min(30 + g.length * 10, 100)
        navigator.vibrate(vibrationDuration)
      }
      
      onUpdate()
      setTimeout(() => {
        // 取得顏色（在清除前）
        const colorIndex = state.grid[g[0][0]][g[0][1]]
        
        // 超級消除：記錄要產生的強化珠（選擇該組最低的一個位置的 column）
        if (isBigMatch && colorIndex >= 0) {
          // 找出該組最低的位置（row 最大）
          let lowestRow = -1
          let lowestCol = -1
          for (const [r, c] of g) {
            if (r > lowestRow) {
              lowestRow = r
              lowestCol = c
            }
          }
          state.pendingEnhanced.push({ col: lowestCol, colorIndex })
        }
        
        for (const [r,c] of g) {
          if (state.grid[r][c] >= 0) { state.grid[r][c] = -1; totalRemoved++ }
        }
        state.matched = undefined
        state.matchedBig = undefined
        gi++
        removeGroup()
      }, isBigMatch ? 280 : 180)  // 大消除動畫時間更長
    }
    removeGroup()
  }
  step()
}

function isTrailCell(state: GameState, r: number, c: number) {
  const now = Date.now()
  for (let i = 0; i < state.trail.length; i++) {
    const t = state.trail[i]
    if (t.row === r && t.col === c && t.until > now) return true
  }
  return false
}

function pruneTrail(state: GameState) {
  const now = Date.now()
  if (state.trail.length === 0) return
  state.trail = state.trail.filter(t => t.until > now)
}

export type GameState = {
  grid: Cell[][]
  enhanced: Map<string, boolean>  // 強化珠位置 "row,col" -> true
  score: number
  lastCombo: number
  dragging: boolean
  dragRow?: number
  dragCol?: number
  dragValue: number
  animating: boolean
  matched?: boolean[][]
  matchedBig?: boolean[][]  // 大消除標記（>5顆）
  justRefilled: boolean
  swapFromRow?: number
  swapFromCol?: number
  swapToRow?: number
  swapToCol?: number
  swapDir?: 'left' | 'right' | 'up' | 'down'
  dragPath?: Set<string>
  trail: Array<{ row: number; col: number; until: number }>
  falling: boolean
  fallDistances: Map<string, number>  // key: "row,col", value: 下落格數
  // 時間限制
  dragStartTime?: number
  dragTimeLimit: number  // 毫秒
  dragTimeRemaining: number
  timerInterval?: number
  // 拖曳跟隨手指
  pointerX?: number
  pointerY?: number
  draggedOrb?: HTMLElement
  // 超級消除產生的強化珠（待落下）
  pendingEnhanced: Array<{ col: number; colorIndex: number }>
}

export function createGame(root: HTMLElement) {
  const state: GameState = {
    grid: makeGrid(),
    enhanced: new Map(),
    score: 0,
    lastCombo: 0,
    dragging: false,
    dragValue: -1,
    animating: false,
    justRefilled: false,
    swapFromRow: undefined,
    swapFromCol: undefined,
    swapToRow: undefined,
    swapToCol: undefined,
    swapDir: undefined,
    dragPath: undefined,
    trail: [],
    falling: false,
    fallDistances: new Map(),
    dragTimeLimit: 5500,  // 5.5 秒
    dragTimeRemaining: 5500,
    pendingEnhanced: [],
  }
  render(root, state)
}
