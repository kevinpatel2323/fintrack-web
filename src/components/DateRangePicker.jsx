import { useState } from 'react';
import './DateRangePicker.css';

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangePreset(preset) {
  const today = new Date();
  const endDate = formatDateForInput(today);
  
  let startDate;
  switch (preset) {
    case '7days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case '30days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      break;
    case '90days':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 90);
      break;
    case 'thisMonth':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'lastMonth':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDateForInput(startDate),
        endDate: formatDateForInput(endOfLastMonth),
      };
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
  }
  
  return {
    startDate: formatDateForInput(startDate),
    endDate,
  };
}

export default function DateRangePicker({ value, onChange, className = '' }) {
  const [localStartDate, setLocalStartDate] = useState(value?.startDate || '');
  const [localEndDate, setLocalEndDate] = useState(value?.endDate || '');
  const [error, setError] = useState('');

  const handleStartDateChange = (e) => {
    const newStartDate = e.target.value;
    setLocalStartDate(newStartDate);
    
    if (newStartDate && localEndDate && newStartDate > localEndDate) {
      setError('Start date must be before or equal to end date');
    } else {
      setError('');
      if (newStartDate && localEndDate) {
        onChange({ startDate: newStartDate, endDate: localEndDate });
      }
    }
  };

  const handleEndDateChange = (e) => {
    const newEndDate = e.target.value;
    setLocalEndDate(newEndDate);
    
    if (localStartDate && newEndDate && localStartDate > newEndDate) {
      setError('End date must be after or equal to start date');
    } else {
      setError('');
      if (localStartDate && newEndDate) {
        onChange({ startDate: localStartDate, endDate: newEndDate });
      }
    }
  };

  const handlePresetClick = (preset) => {
    const range = getDateRangePreset(preset);
    setLocalStartDate(range.startDate);
    setLocalEndDate(range.endDate);
    setError('');
    onChange(range);
  };

  return (
    <div className={`date-range-picker ${className}`.trim()}>
      <div className="date-inputs">
        <div className="date-input-group">
          <label htmlFor="start-date">Start Date</label>
          <input
            id="start-date"
            type="date"
            value={localStartDate}
            onChange={handleStartDateChange}
            max={localEndDate || undefined}
          />
        </div>
        
        <div className="date-input-group">
          <label htmlFor="end-date">End Date</label>
          <input
            id="end-date"
            type="date"
            value={localEndDate}
            onChange={handleEndDateChange}
            min={localStartDate || undefined}
          />
        </div>
      </div>

      <div className="date-presets">
        <button
          type="button"
          className="preset-button"
          onClick={() => handlePresetClick('7days')}
        >
          Last 7 days
        </button>
        <button
          type="button"
          className="preset-button"
          onClick={() => handlePresetClick('30days')}
        >
          Last 30 days
        </button>
        <button
          type="button"
          className="preset-button"
          onClick={() => handlePresetClick('90days')}
        >
          Last 90 days
        </button>
        <button
          type="button"
          className="preset-button"
          onClick={() => handlePresetClick('thisMonth')}
        >
          This month
        </button>
        <button
          type="button"
          className="preset-button"
          onClick={() => handlePresetClick('lastMonth')}
        >
          Last month
        </button>
      </div>

      {error && <p className="date-range-error">{error}</p>}
    </div>
  );
}
