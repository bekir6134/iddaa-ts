import ExcelJS from 'exceljs';
import type { AppCache } from '@/types/cache';
import { LEAGUE_NAMES, formatTurkeyTime, formatTurkeyDateTime } from './utils';

const HEADER_COLOR = '1E3A5F';
const HEADER_FONT_COLOR = 'FFFFFF';
const ALT_ROW_COLOR = 'F0F4F8';
const GREEN = '22C55E';
const YELLOW = 'EAB308';
const RED = 'EF4444';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
    cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    };
  });
  row.height = 20;
}

function styleAltRow(row: ExcelJS.Row, index: number) {
  if (index % 2 === 0) {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_COLOR } };
    });
  }
  row.eachCell((cell) => {
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}

function confidenceColor(score: number): string {
  if (score >= 70) return GREEN;
  if (score >= 50) return YELLOW;
  return RED;
}

// ─── Sheet 1: Bugünkü Maçlar ──────────────────────────────────────────────────

function buildFixturesSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Bugünkü Maçlar');
  ws.columns = [
    { header: 'Tarih', key: 'date', width: 12 },
    { header: 'Saat', key: 'time', width: 8 },
    { header: 'Lig', key: 'league', width: 22 },
    { header: 'Ev Sahibi', key: 'home', width: 22 },
    { header: 'Deplasman', key: 'away', width: 22 },
    { header: 'Tahmin', key: 'prediction', width: 16 },
    { header: '1 Oran', key: 'odd1', width: 9 },
    { header: 'X Oran', key: 'oddX', width: 9 },
    { header: '2 Oran', key: 'odd2', width: 9 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const fixtures = [...cache.fixtures.today, ...cache.fixtures.tomorrow];
  fixtures.forEach((f, i) => {
    const odds = cache.odds.byFixture[f.fixture.id];
    const pred = cache.predictions.byFixture[f.fixture.id];

    const matchWinner = odds?.bookmakers?.[0]?.bets?.find((b) => b.name === 'Match Winner');
    const odd1 = matchWinner?.values?.find((v) => v.value === 'Home')?.odd ?? '-';
    const oddX = matchWinner?.values?.find((v) => v.value === 'Draw')?.odd ?? '-';
    const odd2 = matchWinner?.values?.find((v) => v.value === 'Away')?.odd ?? '-';

    const predWinner = pred?.predictions?.winner?.name ?? pred?.predictions?.advice ?? '-';

    const row = ws.addRow({
      date: f.fixture.date ? f.fixture.date.slice(0, 10) : '-',
      time: f.fixture.date ? formatTurkeyTime(f.fixture.date) : '-',
      league: LEAGUE_NAMES[f.league.id] ?? f.league.name,
      home: f.teams.home.name,
      away: f.teams.away.name,
      prediction: predWinner,
      odd1,
      oddX,
      odd2,
    });
    styleAltRow(row, i);
  });
}

// ─── Sheet 2: Tahminler ───────────────────────────────────────────────────────

function buildPredictionsSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Tahminler');
  ws.columns = [
    { header: 'Maç', key: 'match', width: 36 },
    { header: 'Lig', key: 'league', width: 20 },
    { header: 'Ev %', key: 'homePct', width: 9 },
    { header: 'Beraberlik %', key: 'drawPct', width: 14 },
    { header: 'Deplasman %', key: 'awayPct', width: 14 },
    { header: 'Tavsiye', key: 'advice', width: 28 },
    { header: 'Alt/Üst', key: 'underOver', width: 12 },
    { header: 'Güven', key: 'confidence', width: 10 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  let rowIdx = 0;
  for (const [fixtureId, pred] of Object.entries(cache.predictions.byFixture)) {
    const fixture = [...cache.fixtures.today, ...cache.fixtures.tomorrow].find(
      (f) => f.fixture.id === Number(fixtureId)
    );
    if (!fixture) continue;

    const p = pred.predictions;
    const homePct = parseFloat(p.percent.home);
    const drawPct = parseFloat(p.percent.draw);
    const awayPct = parseFloat(p.percent.away);
    const maxPct = Math.max(homePct, drawPct, awayPct);

    const row = ws.addRow({
      match: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      league: LEAGUE_NAMES[fixture.league.id] ?? fixture.league.name,
      homePct: `${homePct}%`,
      drawPct: `${drawPct}%`,
      awayPct: `${awayPct}%`,
      advice: p.advice,
      underOver: p.under_over ?? '-',
      confidence: `${maxPct}%`,
    });
    styleAltRow(row, rowIdx);

    // Color the confidence cell
    const confCell = row.getCell('confidence');
    confCell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: confidenceColor(maxPct) },
    };
    confCell.font = { bold: true, color: { argb: 'FFFFFF' } };

    rowIdx++;
  }
}

// ─── Sheet 3: Oranlar ─────────────────────────────────────────────────────────

function buildOddsSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Oranlar');
  ws.columns = [
    { header: 'Maç', key: 'match', width: 36 },
    { header: 'Lig', key: 'league', width: 20 },
    { header: '1', key: 'odd1', width: 8 },
    { header: 'X', key: 'oddX', width: 8 },
    { header: '2', key: 'odd2', width: 8 },
    { header: '2.5 Üst', key: 'over25', width: 10 },
    { header: '2.5 Alt', key: 'under25', width: 10 },
    { header: 'KG Var', key: 'bttsYes', width: 10 },
    { header: 'KG Yok', key: 'bttsNo', width: 10 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const fixtures = [...cache.fixtures.today, ...cache.fixtures.tomorrow];
  fixtures.forEach((f, i) => {
    const odds = cache.odds.byFixture[f.fixture.id];
    if (!odds) return;

    const bets = odds.bookmakers?.[0]?.bets ?? [];
    const matchWinner = bets.find((b) => b.name === 'Match Winner');
    const goalsOU = bets.find((b) => b.name === 'Goals Over/Under');
    const btts = bets.find((b) => b.name === 'Both Teams Score');

    const odd1 = matchWinner?.values?.find((v) => v.value === 'Home')?.odd ?? '-';
    const oddX = matchWinner?.values?.find((v) => v.value === 'Draw')?.odd ?? '-';
    const odd2 = matchWinner?.values?.find((v) => v.value === 'Away')?.odd ?? '-';
    const over25 = goalsOU?.values?.find((v) => v.value === 'Over 2.5')?.odd ?? '-';
    const under25 = goalsOU?.values?.find((v) => v.value === 'Under 2.5')?.odd ?? '-';
    const bttsYes = btts?.values?.find((v) => v.value === 'Yes')?.odd ?? '-';
    const bttsNo = btts?.values?.find((v) => v.value === 'No')?.odd ?? '-';

    const row = ws.addRow({
      match: `${f.teams.home.name} vs ${f.teams.away.name}`,
      league: LEAGUE_NAMES[f.league.id] ?? f.league.name,
      odd1, oddX, odd2, over25, under25, bttsYes, bttsNo,
    });
    styleAltRow(row, i);

    // Highlight value bets (odds < 1.5 = strong favorite)
    const pred = cache.predictions.byFixture[f.fixture.id];
    if (pred) {
      const homePct = parseFloat(pred.predictions.percent.home) / 100;
      if (odd1 !== '-' && homePct > 1 / parseFloat(String(odd1))) {
        row.getCell('odd1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      }
    }
  });
}

// ─── Sheet 4: Sakatlıklar ─────────────────────────────────────────────────────

function buildInjuriesSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Sakatlıklar');
  ws.columns = [
    { header: 'Lig', key: 'league', width: 20 },
    { header: 'Takım', key: 'team', width: 22 },
    { header: 'Oyuncu', key: 'player', width: 24 },
    { header: 'Sakatlık Türü', key: 'type', width: 18 },
    { header: 'Neden', key: 'reason', width: 26 },
    { header: 'Maç Tarihi', key: 'date', width: 14 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  let rowIdx = 0;
  for (const injuries of Object.values(cache.injuries.byLeague)) {
    for (const injury of injuries) {
      const row = ws.addRow({
        league: LEAGUE_NAMES[injury.league.id] ?? injury.league.name,
        team: injury.team.name,
        player: injury.player.name,
        type: injury.type,
        reason: injury.reason,
        date: injury.fixture.date ? injury.fixture.date.slice(0, 10) : '-',
      });
      styleAltRow(row, rowIdx);
      rowIdx++;
    }
  }
}

// ─── Sheet 5: Lig Tabloları ───────────────────────────────────────────────────

function buildStandingsSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Lig Tabloları');
  ws.columns = [
    { header: 'Sıra', key: 'rank', width: 6 },
    { header: 'Takım', key: 'team', width: 24 },
    { header: 'O', key: 'played', width: 5 },
    { header: 'G', key: 'win', width: 5 },
    { header: 'B', key: 'draw', width: 5 },
    { header: 'M', key: 'lose', width: 5 },
    { header: 'AG', key: 'gf', width: 6 },
    { header: 'YG', key: 'ga', width: 6 },
    { header: 'AV', key: 'gd', width: 6 },
    { header: 'Puan', key: 'pts', width: 7 },
    { header: 'Form', key: 'form', width: 14 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const [leagueIdStr, groups] of Object.entries(cache.standings.byLeague)) {
    const leagueId = Number(leagueIdStr);
    // League name separator row
    const sepRow = ws.addRow([LEAGUE_NAMES[leagueId] ?? `Lig ${leagueId}`]);
    sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '334155' } };
    sepRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
    sepRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.mergeCells(sepRow.number, 1, sepRow.number, 11);
    sepRow.height = 22;

    for (const group of (groups as import('@/types/api-football').StandingEntry[][])) {
      for (const [i, entry] of group.entries()) {
        const row = ws.addRow({
          rank: entry.rank,
          team: entry.team.name,
          played: entry.all.played,
          win: entry.all.win,
          draw: entry.all.draw,
          lose: entry.all.lose,
          gf: entry.all.goals.for,
          ga: entry.all.goals.against,
          gd: entry.goalsDiff,
          pts: entry.points,
          form: entry.form ?? '-',
        });
        styleAltRow(row, i);
      }
    }
    ws.addRow([]); // blank separator
  }
}

// ─── Sheet 6: H2H Verileri ────────────────────────────────────────────────────

function buildH2HSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('H2H Verileri');
  ws.columns = [
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Ev Sahibi', key: 'home', width: 22 },
    { header: 'Skor', key: 'score', width: 10 },
    { header: 'Deplasman', key: 'away', width: 22 },
    { header: 'Lig', key: 'league', width: 20 },
    { header: 'Sezon', key: 'season', width: 8 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  let rowIdx = 0;
  for (const fixtures of Object.values(cache.h2h.byFixturePair)) {
    for (const f of fixtures) {
      const ht = f.score.fulltime.home;
      const at = f.score.fulltime.away;
      const row = ws.addRow({
        date: f.fixture.date ? f.fixture.date.slice(0, 10) : '-',
        home: f.teams.home.name,
        score: ht !== null && at !== null ? `${ht} - ${at}` : '-',
        away: f.teams.away.name,
        league: LEAGUE_NAMES[f.league.id] ?? f.league.name,
        season: f.league.season,
      });
      styleAltRow(row, rowIdx);
      rowIdx++;
    }
  }
}

// ─── Sheet 7: Takım Formları ──────────────────────────────────────────────────

function buildTeamStatsSheet(wb: ExcelJS.Workbook, cache: AppCache) {
  const ws = wb.addWorksheet('Takım Formları');
  ws.columns = [
    { header: 'Takım', key: 'team', width: 24 },
    { header: 'Lig', key: 'league', width: 20 },
    { header: 'Son Form', key: 'form', width: 14 },
    { header: 'Ort Gol (Ev)', key: 'avgGoalHome', width: 14 },
    { header: 'Ort Gol (Dep)', key: 'avgGoalAway', width: 14 },
    { header: 'Kazanma %', key: 'winPct', width: 12 },
    { header: 'Temiz Sayfa %', key: 'cleanPct', width: 14 },
    { header: 'Oynanan', key: 'played', width: 10 },
  ];
  styleHeader(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  let rowIdx = 0;
  for (const stat of Object.values(cache.teamStats.byTeam)) {
    const played = stat.fixtures.played.total || 1;
    const winPct = Math.round((stat.fixtures.wins.total / played) * 100);
    const cleanPct = Math.round((stat.clean_sheet.total / played) * 100);

    const row = ws.addRow({
      team: stat.team.name,
      league: LEAGUE_NAMES[stat.league.id] ?? stat.league.name,
      form: stat.form?.slice(-8) ?? '-',
      avgGoalHome: stat.goals.for.average.home,
      avgGoalAway: stat.goals.for.average.away,
      winPct: `${winPct}%`,
      cleanPct: `${cleanPct}%`,
      played: stat.fixtures.played.total,
    });
    styleAltRow(row, rowIdx);
    rowIdx++;
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function generateExcel(cache: AppCache): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'İddaa Analiz';
  wb.lastModifiedBy = 'Otomatik Güncelleme';
  wb.created = new Date();
  wb.modified = new Date();

  buildFixturesSheet(wb, cache);
  buildPredictionsSheet(wb, cache);
  buildOddsSheet(wb, cache);
  buildInjuriesSheet(wb, cache);
  buildStandingsSheet(wb, cache);
  buildH2HSheet(wb, cache);
  buildTeamStatsSheet(wb, cache);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
