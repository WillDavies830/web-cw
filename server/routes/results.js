/**
 * API endpoints for race results management
 */

const express = require('express');
const { runQuery, getQuery, allQuery } = require('../db');

const router = express.Router();

// Helper function to format time in HH:MM:SS format
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

// Get all results for a race
router.get('/race/:raceId', async (req, res) => {
  const raceId = req.params.raceId;
  
  try {
    const results = await allQuery(`
      SELECT 
        rr.id, 
        rr.race_id, 
        rr.runner_id, 
        rr.finish_time, 
        rr.chip_time, 
        rr.position,
        r.bib_number, 
        r.name as runner_name
      FROM race_results rr
      JOIN runners r ON rr.runner_id = r.id
      WHERE rr.race_id = ?
      ORDER BY rr.position IS NULL, rr.position, rr.finish_time
    `, [raceId]);
    
    // Calculate race metrics
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    // Add formatted times and other useful data
    const resultsWithFormatting = results.map(result => {
      const elapsedSeconds = result.finish_time ? result.finish_time - race.start_time : null;
      const chipSeconds = result.chip_time || elapsedSeconds;
      
      return {
        ...result,
        elapsed_time: elapsedSeconds,
        elapsed_time_formatted: elapsedSeconds ? formatTime(elapsedSeconds) : null,
        chip_time_formatted: chipSeconds ? formatTime(chipSeconds) : null
      };
    });
    
    res.json(resultsWithFormatting);
  } catch (error) {
    console.error('Error fetching race results:', error);
    res.status(500).json({ error: 'Failed to fetch race results' });
  }
});

// Get results for a specific runner
router.get('/runner/:runnerId', async (req, res) => {
  const runnerId = req.params.runnerId;
  
  try {
    const runner = await getQuery('SELECT * FROM runners WHERE id = ?', [runnerId]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    const result = await getQuery(`
      SELECT 
        rr.id, 
        rr.race_id, 
        rr.runner_id, 
        rr.finish_time, 
        rr.chip_time, 
        rr.position,
        r.bib_number, 
        r.name as runner_name,
        rc.name as race_name,
        rc.start_time
      FROM race_results rr
      JOIN runners r ON rr.runner_id = r.id
      JOIN races rc ON rr.race_id = rc.id
      WHERE rr.runner_id = ?
    `, [runnerId]);
    
    if (!result) {
      return res.json({ runner, results: [] });
    }
    
    // Format result times
    const elapsedSeconds = result.finish_time ? result.finish_time - result.start_time : null;
    const chipSeconds = result.chip_time || elapsedSeconds;
    
    const formattedResult = {
      ...result,
      elapsed_time: elapsedSeconds,
      elapsed_time_formatted: elapsedSeconds ? formatTime(elapsedSeconds) : null,
      chip_time_formatted: chipSeconds ? formatTime(chipSeconds) : null
    };
    
    res.json({ runner, result: formattedResult });
  } catch (error) {
    console.error('Error fetching runner results:', error);
    res.status(500).json({ error: 'Failed to fetch runner results' });
  }
});

// Record a finish time for a runner
router.post('/finish', async (req, res) => {
  const { race_id, runner_id, finish_time, device_id } = req.body;
  
  if (!race_id || !runner_id) {
    return res.status(400).json({ error: 'Race ID and runner ID are required' });
  }
  
  try {
    // Check if race exists and is active
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [race_id]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    if (race.status !== 'active' && race.status !== 'completed') {
      return res.status(400).json({ error: 'Race has not been started' });
    }
    
    // Check if runner exists and belongs to this race
    const runner = await getQuery('SELECT * FROM runners WHERE id = ? AND race_id = ?', [runner_id, race_id]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found or not in this race' });
    }
    
    // Check if result already exists
    const existingResult = await getQuery('SELECT * FROM race_results WHERE race_id = ? AND runner_id = ?', [race_id, runner_id]);
    
    const currentTime = finish_time || Math.floor(Date.now() / 1000);
    
    if (existingResult) {
      // Update existing result
      await runQuery(
        'UPDATE race_results SET finish_time = ?, device_id = ? WHERE id = ?',
        [currentTime, device_id || null, existingResult.id]
      );
      
      // Recalculate positions for all runners in this race
      await updatePositions(race_id);
      
      const updatedResult = await getQuery('SELECT * FROM race_results WHERE id = ?', [existingResult.id]);
      res.json(updatedResult);
    } else {
      // Create new result
      const result = await runQuery(
        'INSERT INTO race_results (race_id, runner_id, finish_time, device_id) VALUES (?, ?, ?, ?)',
        [race_id, runner_id, currentTime, device_id || null]
      );
      
      // Recalculate positions for all runners in this race
      await updatePositions(race_id);
      
      const newResult = await getQuery('SELECT * FROM race_results WHERE id = ?', [result.lastID]);
      res.status(201).json(newResult);
    }
  } catch (error) {
    console.error('Error recording finish time:', error);
    res.status(500).json({ error: 'Failed to record finish time' });
  }
});

// Record a checkpoint result for a runner
router.post('/checkpoint', async (req, res) => {
  const { checkpoint_id, runner_id, passing_time, device_id } = req.body;
  
  if (!checkpoint_id || !runner_id) {
    return res.status(400).json({ error: 'Checkpoint ID and runner ID are required' });
  }
  
  try {
    // Check if checkpoint exists
    const checkpoint = await getQuery('SELECT * FROM checkpoints WHERE id = ?', [checkpoint_id]);
    
    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }
    
    // Check if runner exists
    const runner = await getQuery('SELECT * FROM runners WHERE id = ?', [runner_id]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    // Check if runner belongs to the race of this checkpoint
    if (runner.race_id !== checkpoint.race_id) {
      return res.status(400).json({ error: 'Runner is not in the race for this checkpoint' });
    }
    
    // Check if result already exists
    const existingResult = await getQuery(
      'SELECT * FROM checkpoint_results WHERE checkpoint_id = ? AND runner_id = ?',
      [checkpoint_id, runner_id]
    );
    
    const currentTime = passing_time || Math.floor(Date.now() / 1000);
    
    if (existingResult) {
      // Update existing result
      await runQuery(
        'UPDATE checkpoint_results SET passing_time = ?, device_id = ? WHERE id = ?',
        [currentTime, device_id || null, existingResult.id]
      );
      
      const updatedResult = await getQuery('SELECT * FROM checkpoint_results WHERE id = ?', [existingResult.id]);
      res.json(updatedResult);
    } else {
      // Create new result
      const result = await runQuery(
        'INSERT INTO checkpoint_results (checkpoint_id, runner_id, passing_time, device_id) VALUES (?, ?, ?, ?)',
        [checkpoint_id, runner_id, currentTime, device_id || null]
      );
      
      const newResult = await getQuery('SELECT * FROM checkpoint_results WHERE id = ?', [result.lastID]);
      res.status(201).json(newResult);
    }
  } catch (error) {
    console.error('Error recording checkpoint result:', error);
    res.status(500).json({ error: 'Failed to record checkpoint result' });
  }
});

// Helper function to update positions in a race based on finish times
async function updatePositions(raceId) {
  try {
    // Get all results for this race ordered by finish time
    const results = await allQuery(
      'SELECT id FROM race_results WHERE race_id = ? ORDER BY finish_time',
      [raceId]
    );
    
    // Update positions
    for (let i = 0; i < results.length; i++) {
      await runQuery(
        'UPDATE race_results SET position = ? WHERE id = ?',
        [i + 1, results[i].id]
      );
    }
  } catch (error) {
    console.error('Error updating positions:', error);
    throw error;
  }
}

// Export results as CSV
router.get('/race/:raceId/export', async (req, res) => {
  const raceId = req.params.raceId;
  
  try {
    // Get race details
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    // Get all results with runner info
    const results = await allQuery(`
      SELECT 
        r.bib_number,
        r.name as runner_name,
        rr.position,
        rr.finish_time,
        rr.chip_time
      FROM race_results rr
      JOIN runners r ON rr.runner_id = r.id
      WHERE rr.race_id = ?
      ORDER BY rr.position IS NULL, rr.position, rr.finish_time
    `, [raceId]);
    
    // Generate CSV content
    let csvContent = 'Position,Bib,Name,Finish Time,Chip Time\n';
    
    results.forEach(result => {
      const elapsedSeconds = result.finish_time ? result.finish_time - race.start_time : null;
      const chipSeconds = result.chip_time || elapsedSeconds;
      
      csvContent += [
        result.position || '',
        result.bib_number,
        `"${result.runner_name || ''}"`,
        elapsedSeconds ? formatTime(elapsedSeconds) : '',
        chipSeconds ? formatTime(chipSeconds) : ''
      ].join(',') + '\n';
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${race.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_results.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'Failed to export results' });
  }
});

// Batch upload results
router.post('/batch', async (req, res) => {
  const { race_id, results, device_id } = req.body;
  
  if (!race_id || !results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'Race ID and results array are required' });
  }
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [race_id]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    const processed = [];
    const errors = [];
    
    // Process each result
    for (const result of results) {
      const { runner_id, bib_number, finish_time } = result;
      
      if (!runner_id && !bib_number) {
        errors.push({ result, error: 'Either runner ID or bib number is required' });
        continue;
      }
      
      try {
        let runnerId = runner_id;
        
        // If bib number is provided but not runner ID, look up the runner
        if (!runnerId && bib_number) {
          const runner = await getQuery(
            'SELECT id FROM runners WHERE race_id = ? AND bib_number = ?',
            [race_id, bib_number]
          );
          
          if (!runner) {
            errors.push({ result, error: 'Runner not found with this bib number' });
            continue;
          }
          
          runnerId = runner.id;
        }
        
        // Check if result already exists
        const existingResult = await getQuery(
          'SELECT * FROM race_results WHERE race_id = ? AND runner_id = ?',
          [race_id, runnerId]
        );
        
        const finishTime = finish_time || Math.floor(Date.now() / 1000);
        
        if (existingResult) {
          // Update existing result
          await runQuery(
            'UPDATE race_results SET finish_time = ?, device_id = ? WHERE id = ?',
            [finishTime, device_id || null, existingResult.id]
          );
          
          const updatedResult = await getQuery('SELECT * FROM race_results WHERE id = ?', [existingResult.id]);
          processed.push(updatedResult);
        } else {
          // Create new result
          const newResult = await runQuery(
            'INSERT INTO race_results (race_id, runner_id, finish_time, device_id) VALUES (?, ?, ?, ?)',
            [race_id, runnerId, finishTime, device_id || null]
          );
          
          const savedResult = await getQuery('SELECT * FROM race_results WHERE id = ?', [newResult.lastID]);
          processed.push(savedResult);
        }
      } catch (error) {
        errors.push({ result, error: error.message });
      }
    }
    
    // Update positions after all results are processed
    await updatePositions(race_id);
    
    res.status(201).json({ processed, errors });
  } catch (error) {
    console.error('Error batch uploading results:', error);
    res.status(500).json({ error: 'Failed to upload results' });
  }
});

module.exports = router;