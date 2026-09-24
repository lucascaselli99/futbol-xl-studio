function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Falta FOOTBALL_DATA_API_KEY en Vercel.' });
  }

  try {
    const timeZone = 'America/Argentina/Buenos_Aires';
    const now = new Date();
    const until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dateFrom = dateInTimeZone(now, timeZone);
    const dateTo = dateInTimeZone(until, timeZone);
    const params = new URLSearchParams({ dateFrom, dateTo });

    const response = await fetch(`https://api.football-data.org/v4/matches?${params.toString()}`, {
      headers: { 'X-Auth-Token': apiKey },
    });
    const data = await response.json();

    if (!response.ok) {
      console.error('[Football-Data]', data);
      return sendJson(res, response.status, {
        error: data?.message || 'Football-Data rechazó la consulta.',
      });
    }

    const matches = (data.matches || []).map((match) => {
      const score = match.score?.fullTime || {};
      return {
        id: match.id,
        competition: match.competition?.name || '',
        competitionCode: match.competition?.code || '',
        home: match.homeTeam?.shortName || match.homeTeam?.name || '',
        away: match.awayTeam?.shortName || match.awayTeam?.name || '',
        homeCrest: match.homeTeam?.crest || '',
        awayCrest: match.awayTeam?.crest || '',
        utcDate: match.utcDate,
        status: match.status,
        score: {
          home: Number.isFinite(score.home) ? score.home : null,
          away: Number.isFinite(score.away) ? score.away : null,
        },
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return sendJson(res, 200, {
      matches,
      dateFrom,
      dateTo,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Football-Data]', error);
    return sendJson(res, 500, { error: 'No se pudieron cargar los partidos.' });
  }
};
