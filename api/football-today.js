function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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
    const response = await fetch('https://api.football-data.org/v4/matches', {
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

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return sendJson(res, 200, { matches, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Football-Data]', error);
    return sendJson(res, 500, { error: 'No se pudieron cargar los partidos.' });
  }
};
