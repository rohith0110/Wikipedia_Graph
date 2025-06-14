// src/App.js (The Final, Correctly Architected Version)
import React, { useState, useEffect } from 'react';
import AsyncSelect from 'react-select/async';
import WikiGraph from './WikiGraph';
import './App.css';

const API_URL = "http://13.60.221.255:5000";

function App() {
  const [viewMode, setViewMode] = useState('overview');
  const [elements, setElements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTopic, setCurrentTopic] = useState("Galaxy View");

  const fetchOverview = () => {
    setIsLoading(true);
    setCurrentTopic("Galaxy View");
    fetch(`${API_URL}/api/overview-graph`)
      .then(res => res.json())
      .then(data => {
        setElements(data);
        setViewMode('overview');
        setIsLoading(false);
      });
  };

  useEffect(() => { fetchOverview(); }, []);

  const loadOptions = (inputValue, callback) => {
    if (!inputValue || inputValue.length < 3) return callback([]);
    fetch(`${API_URL}/api/search?q=${inputValue}`)
      .then(res => res.json()).then(data => callback(data));
  };

  const handleNodeSelect = (selectedOption) => {
    if (!selectedOption) return;
    setIsLoading(true);
    setCurrentTopic(selectedOption.label);
    fetch(`${API_URL}/api/graph/${selectedOption.value}`)
      .then(res => res.json())
      .then(data => {
        setElements(data);
        setViewMode('detail');
        setIsLoading(false);
      });
  };

  return (
    <div className="app-container">
      <div className="search-bar-container">
        <AsyncSelect cacheOptions loadOptions={loadOptions} defaultOptions onChange={handleNodeSelect} placeholder="Search to drill down..." isClearable />
      </div>
      {viewMode === 'detail' && (
        <button onClick={fetchOverview} className="overview-button">
          ← Back to Galaxy View
        </button>
      )}
      {/* THIS KEY PROP IS CRITICAL: It forces a full remount, preventing all lifecycle bugs */}
      <WikiGraph key={viewMode + currentTopic} elements={elements} isLoading={isLoading} topic={currentTopic} viewMode={viewMode} />
    </div>
  );
}
export default App;