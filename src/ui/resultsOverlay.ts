import {
  ScoreEntry,
  StorageLike,
  addScore,
  loadScores,
  sanitizeName,
  saveScores,
} from '../game/leaderboard';
import { formatTime } from './timerDisplay';

const PANEL_STYLE = `
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 340px;
  padding: 28px 32px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #fff;
  background: linear-gradient(160deg, rgba(15, 20, 34, 0.95), rgba(30, 38, 60, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
  text-align: center;
  z-index: 10;
`;

// Full-race results flow: name entry on finish, then the top-10 leaderboard.
// All user-supplied text is rendered via textContent to avoid injection.
export class ResultsOverlay {
  private panel: HTMLDivElement;
  private storage: StorageLike;
  private onRestart: () => void;

  constructor(storage: StorageLike, onRestart: () => void) {
    this.storage = storage;
    this.onRestart = onRestart;
    this.panel = document.createElement('div');
    this.panel.style.cssText = PANEL_STYLE;
    this.panel.style.display = 'none';
    document.body.appendChild(this.panel);
  }

  isOpen(): boolean {
    return this.panel.style.display !== 'none';
  }

  showNameEntry(timeMs: number): void {
    this.panel.replaceChildren();
    this.panel.style.display = 'block';

    this.panel.append(
      makeTitle('FINISH!'),
      makeSubtitle('Your time'),
      makeTimeText(formatTime(timeMs))
    );

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 20;
    input.placeholder = 'Enter your name';
    input.style.cssText =
      'margin-top:18px;padding:10px 14px;width:85%;font-size:16px;border-radius:8px;' +
      'border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.35);color:#fff;outline:none;text-align:center;';

    const button = document.createElement('button');
    button.textContent = 'Save time';
    button.style.cssText =
      'margin-top:14px;padding:10px 26px;font-size:16px;font-weight:600;border:none;border-radius:8px;' +
      'background:#4ade80;color:#0f1422;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';

    const submit = () => {
      const entry: ScoreEntry = {
        name: sanitizeName(input.value),
        timeMs,
        date: new Date().toISOString().slice(0, 10),
      };
      const scores = addScore(loadScores(this.storage), entry);
      saveScores(this.storage, scores);
      this.showLeaderboard(entry);
    };

    button.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
    });

    this.panel.append(input, button);
    input.focus();
  }

  showLeaderboard(highlight?: ScoreEntry): void {
    this.panel.replaceChildren();
    this.panel.style.display = 'block';

    this.panel.append(makeTitle('LEADERBOARD'));

    const scores = loadScores(this.storage);
    if (scores.length === 0) {
      this.panel.append(makeSubtitle('No times yet — finish a lap to set one!'));
    } else {
      const table = document.createElement('table');
      table.style.cssText =
        'width:100%;margin-top:14px;border-collapse:collapse;font-size:16px;text-align:left;';
      scores.forEach((score, i) => {
        const row = document.createElement('tr');
        const isHighlight = highlight === score;
        row.style.cssText = `border-bottom:1px solid rgba(255,255,255,0.12);${
          isHighlight ? 'color:#4ade80;font-weight:700;' : ''
        }`;
        const rank = document.createElement('td');
        rank.textContent = `${i + 1}.`;
        rank.style.cssText = 'padding:7px 10px 7px 4px;width:32px;opacity:0.7;';
        const name = document.createElement('td');
        name.textContent = score.name;
        name.style.padding = '7px 10px';
        const time = document.createElement('td');
        time.textContent = formatTime(score.timeMs);
        time.style.cssText = 'padding:7px 4px;text-align:right;font-family:monospace;';
        row.append(rank, name, time);
        table.appendChild(row);
      });
      this.panel.append(table);
    }

    const hint = document.createElement('div');
    hint.textContent = 'Press R to race again · L to close';
    hint.style.cssText = 'margin-top:18px;font-size:13px;opacity:0.65;';
    this.panel.append(hint);

    const button = document.createElement('button');
    button.textContent = 'Race again';
    button.style.cssText =
      'margin-top:12px;padding:10px 26px;font-size:16px;font-weight:600;border:none;border-radius:8px;' +
      'background:#4ade80;color:#0f1422;cursor:pointer;';
    button.addEventListener('click', () => {
      this.hide();
      this.onRestart();
    });
    this.panel.append(button);
  }

  hide(): void {
    this.panel.style.display = 'none';
    this.panel.replaceChildren();
  }
}

function makeTitle(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'font-size:30px;font-weight:800;letter-spacing:3px;color:#4ade80;';
  return el;
}

function makeSubtitle(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'margin-top:10px;font-size:14px;opacity:0.7;';
  return el;
}

function makeTimeText(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'margin-top:4px;font-size:38px;font-family:monospace;font-weight:700;';
  return el;
}
