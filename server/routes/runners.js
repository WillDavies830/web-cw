/**
 * API endpoints for runner management
 */

const express = require('express');
const { runQuery, getQuery, allQuery } = require('../db');

const router = express.Router();

// Get all runners for a race
router.get('/race/:raceId', async (req, res) => {
  const raceId = req.params.raceId;
  
  try {
    const runners = await allQuery(
      'SELECT * FROM runners WHERE race_id = ? ORDER BY bib_number',
      [raceId]
    );
    res.json(runners);
  } catch (error) {
    console.error('Error fetching runners:', error);
    res.status(500).json({ error: 'Failed to fetch runners' });
  }
});

// Get a specific runner
router.get('/:id', async (req, res) => {
  try {
    const runner = await getQuery('SELECT * FROM runners WHERE id = ?', [req.params.id]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    res.json(runner);
  } catch (error) {
    console.error('Error fetching runner:', error);
    res.status(500).json({ error: 'Failed to fetch runner' });
  }
});

// Get runner by bib number
router.get('/race/:raceId/bib/:bibNumber', async (req, res) => {
  const { raceId, bibNumber } = req.params;
  
  try {
    const runner = await getQuery(
      'SELECT * FROM runners WHERE race_id = ? AND bib_number = ?',
      [raceId, bibNumber]
    );
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    res.json(runner);
  } catch (error) {
    console.error('Error fetching runner by bib number:', error);
    res.status(500).json({ error: 'Failed to fetch runner' });
  }
});

// Add a new runner to a race
router.post('/', async (req, res) => {
  const { race_id, bib_number, name } = req.body;
  
  if (!race_id || !bib_number) {
    return res.status(400).json({ error: 'Race ID and bib number are required' });
  }
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [race_id]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    // Check if bib number is already used in this race
    const existingRunner = await getQuery(
      'SELECT * FROM runners WHERE race_id = ? AND bib_number = ?',
      [race_id, bib_number]
    );
    
    if (existingRunner) {
      return res.status(409).json({ error: 'Bib number already in use for this race' });
    }
    
    // Add runner
    const result = await runQuery(
      'INSERT INTO runners (race_id, bib_number, name) VALUES (?, ?, ?)',
      [race_id, bib_number, name || '']
    );
    
    const newRunner = await getQuery('SELECT * FROM runners WHERE id = ?', [result.lastID]);
    res.status(201).json(newRunner);
  } catch (error) {
    console.error('Error adding runner:', error);
    res.status(500).json({ error: 'Failed to add runner' });
  }
});

// Update a runner
router.put('/:id', async (req, res) => {
  const { name, bib_number } = req.body;
  const runnerId = req.params.id;
  
  try {
    // Check if runner exists
    const runner = await getQuery('SELECT * FROM runners WHERE id = ?', [runnerId]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    // If bib number is being changed, check it's not already in use
    if (bib_number && bib_number !== runner.bib_number) {
      const existingRunner = await getQuery(
        'SELECT * FROM runners WHERE race_id = ? AND bib_number = ? AND id != ?',
        [runner.race_id, bib_number, runnerId]
      );
      
      if (existingRunner) {
        return res.status(409).json({ error: 'Bib number already in use for this race' });
      }
    }
    
    // Update runner
    await runQuery(
      'UPDATE runners SET name = ?, bib_number = ? WHERE id = ?',
      [
        name !== undefined ? name : runner.name,
        bib_number || runner.bib_number,
        runnerId
      ]
    );
    
    const updatedRunner = await getQuery('SELECT * FROM runners WHERE id = ?', [runnerId]);
    res.json(updatedRunner);
  } catch (error) {
    console.error('Error updating runner:', error);
    res.status(500).json({ error: 'Failed to update runner' });
  }
});

// Delete a runner
router.delete('/:id', async (req, res) => {
  const runnerId = req.params.id;
  
  try {
    // Check if runner exists
    const runner = await getQuery('SELECT * FROM runners WHERE id = ?', [runnerId]);
    
    if (!runner) {
      return res.status(404).json({ error: 'Runner not found' });
    }
    
    // Delete runner and related results
    await runQuery('DELETE FROM race_results WHERE runner_id = ?', [runnerId]);
    await runQuery('DELETE FROM checkpoint_results WHERE runner_id = ?', [runnerId]);
    await runQuery('DELETE FROM runners WHERE id = ?', [runnerId]);
    
    res.json({ message: 'Runner deleted successfully' });
  } catch (error) {
    console.error('Error deleting runner:', error);
    res.status(500).json({ error: 'Failed to delete runner' });
  }
});

// Bulk import runners (from CSV-like format)
router.post('/bulk', async (req, res) => {
  const { race_id, runners } = req.body;
  
  if (!race_id || !runners || !Array.isArray(runners)) {
    return res.status(400).json({ error: 'Race ID and runners array are required' });
  }
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [race_id]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    const added = [];
    const errors = [];
    
    // Process each runner
    for (const runner of runners) {
      const { bib_number, name } = runner;
      
      if (!bib_number) {
        errors.push({ runner, error: 'Bib number is required' });
        continue;
      }
      
      try {
        // Check if bib number is already used
        const existingRunner = await getQuery(
          'SELECT * FROM runners WHERE race_id = ? AND bib_number = ?',
          [race_id, bib_number]
        );
        
        if (existingRunner) {
          errors.push({ runner, error: 'Bib number already in use' });
          continue;
        }
        
        // Add runner
        const result = await runQuery(
          'INSERT INTO runners (race_id, bib_number, name) VALUES (?, ?, ?)',
          [race_id, bib_number, name || '']
        );
        
        const newRunner = await getQuery('SELECT * FROM runners WHERE id = ?', [result.lastID]);
        added.push(newRunner);
      } catch (error) {
        errors.push({ runner, error: error.message });
      }
    }
    
    res.status(201).json({ added, errors });
  } catch (error) {
    console.error('Error bulk importing runners:', error);
    res.status(500).json({ error: 'Failed to import runners' });
  }
});

module.exports = router;