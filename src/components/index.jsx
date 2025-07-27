import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import User from "./user";
import './styles.css';

// LRU Cache implementation for search results
class LRUCache {
  constructor(capacity = 50) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

export default function GithubProfileFinder() {
  const [userName, setUserName] = useState("");
  const [userData, setUserData] = useState(null);
  const [userRepositories, setUserRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [error, setError] = useState(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  
  // Refs for cleanup and optimization
  const suggestionTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const userAbortControllerRef = useRef(null);
  const repoAbortControllerRef = useRef(null);
  const cacheRef = useRef(new LRUCache(50));
  const userCacheRef = useRef(new LRUCache(20));
  const repoCacheRef = useRef(new LRUCache(20));
  
  // Rate limiting state
  const [rateLimitInfo, setRateLimitInfo] = useState({
    remaining: null,
    resetTime: null,
    isLimited: false
  });

  // Cleanup function for abort controllers
  const cleanupAbortController = useCallback((controllerRef) => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  // Enhanced error handling with rate limit detection
  const handleApiError = useCallback((error, response) => {
    if (response) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetTime = response.headers.get('X-RateLimit-Reset');
      
      setRateLimitInfo({
        remaining: remaining ? parseInt(remaining) : null,
        resetTime: resetTime ? new Date(parseInt(resetTime) * 1000) : null,
        isLimited: response.status === 403 && remaining === '0'
      });

      if (response.status === 403 && remaining === '0') {
        return "Rate limit exceeded. Please try again later.";
      }
    }

    if (error.name === 'AbortError') {
      return null; // Don't show error for cancelled requests
    }

    return error.message || "Network error. Please try again.";
  }, []);

  // Helper function to get GitHub API headers with optional token
  const getGitHubHeaders = useCallback(() => {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Profile-Finder'
    };

    // Add token if available in environment variables
    const token = import.meta.env.VITE_GITHUB_TOKEN;
    if (token && token !== 'your_github_personal_access_token_here') {
      headers['Authorization'] = `token ${token}`;
    }

    return headers;
  }, []);

  // Optimized debounced function to fetch suggestions with caching
  const fetchSuggestions = useCallback(async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    // Check cache first
    const cacheKey = `suggestions_${query.toLowerCase()}`;
    const cachedResult = cacheRef.current.get(cacheKey);
    
    if (cachedResult) {
      setSuggestions(cachedResult);
      setShowSuggestions(true);
      setIsLoadingSuggestions(false);
      return;
    }

    // Cancel previous request
    cleanupAbortController(abortControllerRef);
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    setIsLoadingSuggestions(true);

    try {
      const searchQuery = encodeURIComponent(query.trim());
      const response = await fetch(
        `https://api.github.com/search/users?q=${searchQuery}&per_page=8&sort=followers&order=desc`,
        { 
          signal: abortControllerRef.current.signal,
          headers: getGitHubHeaders()
        }
      );
      
      // Update rate limit info
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetTime = response.headers.get('X-RateLimit-Reset');
      
      setRateLimitInfo(prev => ({
        ...prev,
        remaining: remaining ? parseInt(remaining) : prev.remaining,
        resetTime: resetTime ? new Date(parseInt(resetTime) * 1000) : prev.resetTime,
        isLimited: response.status === 403 && remaining === '0'
      }));
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.items) {
        // Cache the results
        cacheRef.current.set(cacheKey, data.items);
        setSuggestions(data.items);
        setShowSuggestions(true);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, null);
      if (errorMessage) {
        console.error('Error fetching suggestions:', errorMessage);
        setSuggestions([]);
      }
    } finally {
      setIsLoadingSuggestions(false);
      abortControllerRef.current = null;
    }
  }, [cleanupAbortController, handleApiError, getGitHubHeaders]);

  // New function to fetch user repositories with caching
  const fetchUserRepositories = useCallback(async (username) => {
    if (!username) return;

    const trimmedUsername = username.trim();
    
    // Check cache first
    const cacheKey = `repos_${trimmedUsername.toLowerCase()}`;
    const cachedRepos = repoCacheRef.current.get(cacheKey);
    
    if (cachedRepos) {
      setUserRepositories(cachedRepos);
      return;
    }

    setLoadingRepos(true);
    
    // Cancel previous repository request
    cleanupAbortController(repoAbortControllerRef);
    repoAbortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(trimmedUsername)}/repos?sort=updated&per_page=10&type=public`,
        { 
          signal: repoAbortControllerRef.current.signal,
          headers: getGitHubHeaders()
        }
      );
      
      // Update rate limit info
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetTime = response.headers.get('X-RateLimit-Reset');
      
      setRateLimitInfo(prev => ({
        ...prev,
        remaining: remaining ? parseInt(remaining) : prev.remaining,
        resetTime: resetTime ? new Date(parseInt(resetTime) * 1000) : prev.resetTime,
        isLimited: response.status === 403 && remaining === '0'
      }));
      
      if (response.ok) {
        const repos = await response.json();
        
        // Filter and format repositories
        const formattedRepos = repos
          .filter(repo => !repo.private)
          .map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            homepage: repo.homepage,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            updated_at: repo.updated_at,
            topics: repo.topics || []
          }))
          .slice(0, 8); // Show top 8 repositories
        
        // Cache the repositories
        repoCacheRef.current.set(cacheKey, formattedRepos);
        setUserRepositories(formattedRepos);
      } else {
        console.error('Error fetching repositories:', response.status);
        setUserRepositories([]);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, null);
      if (errorMessage) {
        console.error('Error fetching repositories:', errorMessage);
      }
      setUserRepositories([]);
    } finally {
      setLoadingRepos(false);
      repoAbortControllerRef.current = null;
    }
  }, [cleanupAbortController, handleApiError, getGitHubHeaders]);

  // Updated function to fetch user data with repository fetching
  const fetchGithubUserData = useCallback(async (searchUsername = userName) => {
    const trimmedUsername = searchUsername.trim();
    
    if (!trimmedUsername) {
      setError("Please enter a username");
      return;
    }

    // Check cache first
    const cacheKey = `user_${trimmedUsername.toLowerCase()}`;
    const cachedUser = userCacheRef.current.get(cacheKey);
    
    if (cachedUser) {
      setUserData(cachedUser);
      setShowSuggestions(false);
      setSuggestions([]);
      setError(null);
      addToSearchHistory(trimmedUsername);
      
      // Fetch repositories for cached user
      fetchUserRepositories(trimmedUsername);
      return;
    }

    setLoading(true);
    setError(null);
    setUserRepositories([]); // Clear previous repos
    
    // Cancel previous user request
    cleanupAbortController(userAbortControllerRef);
    userAbortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(trimmedUsername)}`,
        { 
          signal: userAbortControllerRef.current.signal,
          headers: getGitHubHeaders()
        }
      );
      
      // Update rate limit info
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const resetTime = response.headers.get('X-RateLimit-Reset');
      
      setRateLimitInfo(prev => ({
        ...prev,
        remaining: remaining ? parseInt(remaining) : prev.remaining,
        resetTime: resetTime ? new Date(parseInt(resetTime) * 1000) : prev.resetTime,
        isLimited: response.status === 403 && remaining === '0'
      }));
      
      const data = await response.json();
      
      if (response.ok && data) {
        // Cache the user data
        userCacheRef.current.set(cacheKey, data);
        setUserData(data);
        setShowSuggestions(false);
        setSuggestions([]);
        addToSearchHistory(trimmedUsername);
        
        // Fetch user repositories
        fetchUserRepositories(trimmedUsername);
      } else {
        const errorMessage = handleApiError(null, response) || data.message || "User not found";
        setError(errorMessage);
        setUserData(null);
        setUserRepositories([]);
      }
    } catch (error) {
      const errorMessage = handleApiError(error, null);
      if (errorMessage) {
        setError(errorMessage);
        setUserData(null);
        setUserRepositories([]);
      }
    } finally {
      setLoading(false);
      userAbortControllerRef.current = null;
    }
  }, [userName, cleanupAbortController, handleApiError, fetchUserRepositories, getGitHubHeaders]);

  // Add to search history
  const addToSearchHistory = useCallback((username) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== username.toLowerCase());
      return [username, ...filtered].slice(0, 5); // Keep last 5 searches
    });
  }, []);

  // Optimized submit handler
  const handleSubmit = useCallback(() => {
    if (userName.trim()) {
      fetchGithubUserData(userName.trim());
    }
  }, [userName, fetchGithubUserData]);

  // Optimized input change handler with better debouncing
  const handleInputChange = useCallback((event) => {
    const value = event.target.value;
    setUserName(value);
    setActiveSuggestion(-1);
    setError(null);

    // Clear existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // Cancel ongoing suggestion request if input is cleared
    if (!value.trim()) {
      cleanupAbortController(abortControllerRef);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    // Debounce API calls - reduced to 250ms for better responsiveness
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 250);
  }, [fetchSuggestions, cleanupAbortController]);

  // Optimized keyboard handler
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !showSuggestions) {
      event.preventDefault();
      handleSubmit();
      return;
    }

    if (!showSuggestions) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeSuggestion >= 0) {
          selectSuggestion(suggestions[activeSuggestion]);
        } else {
          handleSubmit();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        cleanupAbortController(abortControllerRef);
        break;
    }
  }, [showSuggestions, suggestions, activeSuggestion, handleSubmit, cleanupAbortController]);

  // Optimized suggestion selection
  const selectSuggestion = useCallback((suggestion) => {
    setUserName(suggestion.login);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    cleanupAbortController(abortControllerRef);
    
    // Automatically search when suggestion is selected
    setTimeout(() => {
      fetchGithubUserData(suggestion.login);
    }, 50); // Reduced delay
  }, [fetchGithubUserData, cleanupAbortController]);

  // Optimized blur handler
  const handleInputBlur = useCallback(() => {
    // Delay hiding suggestions to allow click events
    setTimeout(() => {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }, 200);
  }, []);

  // Optimized focus handler
  const handleInputFocus = useCallback(() => {
    if (suggestions.length > 0 && userName.length >= 2) {
      setShowSuggestions(true);
    }
  }, [suggestions.length, userName.length]);

  // Clear cache function
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    userCacheRef.current.clear();
    repoCacheRef.current.clear();
    setSearchHistory([]);
    setUserRepositories([]);
  }, []);

  // Memoized suggestions list for better performance
  const suggestionsList = useMemo(() => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
      <div className="suggestions-dropdown">
        {isLoadingSuggestions && (
          <div className="suggestion-loading">
            <span>Searching...</span>
          </div>
        )}
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            className={`suggestion-item ${index === activeSuggestion ? 'active' : ''}`}
            onClick={() => selectSuggestion(suggestion)}
          >
            <img 
              src={suggestion.avatar_url} 
              alt={suggestion.login}
              className="suggestion-avatar"
              loading="lazy"
            />
            <div className="suggestion-info">
              <span className="suggestion-username">{suggestion.login}</span>
              {suggestion.type && (
                <span className="suggestion-type">{suggestion.type}</span>
              )}
              {suggestion.score && (
                <span className="suggestion-score">Score: {Math.round(suggestion.score)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }, [showSuggestions, suggestions, activeSuggestion, isLoadingSuggestions, selectSuggestion]);

  // Load default user on mount
  useEffect(() => {
    fetchGithubUserData("ankitdeardigital");
  }, [fetchGithubUserData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
      cleanupAbortController(abortControllerRef);
      cleanupAbortController(userAbortControllerRef);
      cleanupAbortController(repoAbortControllerRef);
    };
  }, [cleanupAbortController]);

  // Memoized error message
  const errorMessage = useMemo(() => {
    if (!error) return null;
    
    return (
      <div className="error-message">
        <p>{error}</p>
        {rateLimitInfo.isLimited && rateLimitInfo.resetTime && (
          <div className="rate-limit-info">
            <p>Rate limit resets at: {rateLimitInfo.resetTime.toLocaleTimeString()}</p>
            <div className="rate-limit-solutions">
              <h4>💡 Solutions to avoid rate limits:</h4>
              <ul>
                <li>🔑 Add a GitHub token to get 5000 requests/hour instead of 60</li>
                <li>⏰ Wait until {rateLimitInfo.resetTime.toLocaleTimeString()} for the limit to reset</li>
                <li>💾 Use cached results from search history</li>
                <li>🧹 Clear cache to free up memory and rely on cached data</li>
              </ul>
              <div className="token-instructions">
                <p><strong>How to add a GitHub token:</strong></p>
                <ol>
                  <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">GitHub Settings → Tokens</a></li>
                  <li>Generate a new token (no special permissions needed)</li>
                  <li>Create a <code>.env</code> file in your project root</li>
                  <li>Add: <code>VITE_GITHUB_TOKEN=your_token_here</code></li>
                  <li>Restart the development server</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [error, rateLimitInfo]);

  // Memoized search history
  const searchHistoryComponent = useMemo(() => {
    if (searchHistory.length === 0) return null;

    return (
      <div className="search-history">
        <span className="history-label">Recent searches:</span>
        {searchHistory.map((username, index) => (
          <button
            key={index}
            className="history-item"
            onClick={() => {
              setUserName(username);
              fetchGithubUserData(username);
            }}
          >
            {username}
          </button>
        ))}
        <button className="clear-cache-btn" onClick={clearCache} title="Clear cache and history">
          Clear
        </button>
      </div>
    );
  }, [searchHistory, fetchGithubUserData, clearCache]);

  if (loading) {
    return (
      <div className="github-profile-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h1>Loading user data...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="github-profile-container">
      <div className="input-wrapper">
        <div className="search-container">
          <input
            name="search-by-username"
            type="text"
            placeholder="Search Github Username..."
            value={userName}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            autoComplete="off"
            aria-label="GitHub username search"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            disabled={rateLimitInfo.isLimited}
          />
          {suggestionsList}
        </div>
        <button 
          onClick={handleSubmit} 
          disabled={!userName.trim() || loading || rateLimitInfo.isLimited}
          className="search-button"
          title={rateLimitInfo.isLimited ? 'Rate limit exceeded. Please wait or add a GitHub token.' : ''}
        >
          {loading ? 'Searching...' : rateLimitInfo.isLimited ? 'Rate Limited' : 'Search'}
        </button>
      </div>
      
      {/* Rate limit warning for low remaining calls */}
      {rateLimitInfo.remaining !== null && rateLimitInfo.remaining <= 10 && rateLimitInfo.remaining > 0 && (
        <div className="rate-limit-warning">
          <div className="warning-content">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <p><strong>Low API calls remaining: {rateLimitInfo.remaining}</strong></p>
              <p>Consider adding a GitHub token to get 5000 requests/hour instead of 60.</p>
              {rateLimitInfo.resetTime && (
                <p>Rate limit resets at: {rateLimitInfo.resetTime.toLocaleTimeString()}</p>
              )}
            </div>
            <a 
              href="https://github.com/settings/tokens" 
              target="_blank" 
              rel="noopener noreferrer"
              className="get-token-link"
            >
              Get Token
            </a>
          </div>
        </div>
      )}
      
      {searchHistoryComponent}
      {errorMessage}
      
      {userData !== null ? (
        <User 
          user={userData} 
          repositories={userRepositories}
          loadingRepos={loadingRepos}
        />
      ) : null}
      
      {rateLimitInfo.remaining !== null && (
        <div className={`rate-limit-display ${rateLimitInfo.remaining <= 10 ? 'warning' : ''} ${rateLimitInfo.isLimited ? 'limited' : ''}`}>
          API calls remaining: {rateLimitInfo.remaining}
          {import.meta.env.VITE_GITHUB_TOKEN && import.meta.env.VITE_GITHUB_TOKEN !== 'your_github_personal_access_token_here' && (
            <span className="token-active"> (🔑 Token Active)</span>
          )}
        </div>
      )}
    </div>
  );
}