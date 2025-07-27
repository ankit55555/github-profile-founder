export default function User({ user, repositories = [], loadingRepos = false }) {
    const {
      avatar_url,
      followers,
      following,
      public_repos,
      name,
      login,
      created_at,
      company,
      location,
      bio,
      blog,
      twitter_username,
      email,
      hireable
    } = user;
  
    const createdDate = new Date(created_at);

    // Helper function to format repository stats
    const formatNumber = (num) => {
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
      }
      return num.toString();
    };

    // Helper function to get language color
    const getLanguageColor = (language) => {
      const colors = {
        JavaScript: '#f7df1e',
        TypeScript: '#3178c6',
        Python: '#3776ab',
        Java: '#007396',
        'C++': '#00599c',
        C: '#555555',
        'C#': '#239120',
        PHP: '#777bb4',
        Ruby: '#cc342d',
        Go: '#00add8',
        Rust: '#000000',
        Swift: '#fa7343',
        Kotlin: '#7f52ff',
        Dart: '#0175c2',
        HTML: '#e34f26',
        CSS: '#1572b6',
        Shell: '#89e051',
        Vue: '#4fc08d',
        React: '#61dafb',
        Angular: '#dd0031'
      };
      return colors[language] || '#6b7280';
    };
  
    return (
      <div className="user">
        {/* Background decoration elements */}
        <div className="user-background-decoration">
          <div className="decoration-circle decoration-circle-1"></div>
          <div className="decoration-circle decoration-circle-2"></div>
          <div className="decoration-circle decoration-circle-3"></div>
        </div>

        {/* Main user content */}
        <div className="user-content">
          {/* Left Section - Avatar and Basic Info */}
          <div className="user-left-section">
            <div className="avatar-container">
              <img src={avatar_url} className="avatar" alt="User" />
              <div className="avatar-ring"></div>
            </div>
            
            <div className="user-basic-info">
              <div className="name-container">
                <a 
                  href={`https://github.com/${login}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="github-link"
                >
                  {name || login}
                </a>
                {hireable && (
                  <span className="hireable-badge">Available for hire</span>
                )}
              </div>
              
              <p className="join-date">
                Member since{" "}
                {`${createdDate.toLocaleString("en-us", {
                  month: "short",
                })} ${createdDate.getFullYear()}`}
              </p>

              {/* Bio Section */}
              {bio && (
                <div className="bio-section">
                  <p className="bio-text">{bio}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Section - Details and Stats */}
          <div className="user-right-section">
            {/* Stats Cards */}
            <div className="stats-section">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-content">
                  <span className="stat-label">Public Repos</span>
                  <span className="stat-value">{public_repos}</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <span className="stat-label">Followers</span>
                  <span className="stat-value">{followers}</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🔗</div>
                <div className="stat-content">
                  <span className="stat-label">Following</span>
                  <span className="stat-value">{following}</span>
                </div>
              </div>
            </div>

            {/* Details Section */}
            {(company || location || blog || twitter_username || email) && (
              <div className="details-section">
                <h4 className="details-title">Contact & Info</h4>
                <div className="details-grid">
                  {company && (
                    <div className="detail-item">
                      <span className="detail-icon">🏢</span>
                      <span className="detail-text">{company}</span>
                    </div>
                  )}
                  {location && (
                    <div className="detail-item">
                      <span className="detail-icon">📍</span>
                      <span className="detail-text">{location}</span>
                    </div>
                  )}
                  {blog && (
                    <div className="detail-item">
                      <span className="detail-icon">🌐</span>
                      <a 
                        href={blog.startsWith('http') ? blog : `https://${blog}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="detail-link"
                      >
                        {blog}
                      </a>
                    </div>
                  )}
                  {twitter_username && (
                    <div className="detail-item">
                      <span className="detail-icon">🐦</span>
                      <a 
                        href={`https://twitter.com/${twitter_username}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="detail-link"
                      >
                        @{twitter_username}
                      </a>
                    </div>
                  )}
                  {email && (
                    <div className="detail-item">
                      <span className="detail-icon">📧</span>
                      <a 
                        href={`mailto:${email}`}
                        className="detail-link"
                      >
                        {email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Public Repositories Section */}
        {public_repos > 0 && (
          <div className="repositories-section">
            <div className="section-header">
              <h3 className="section-title">
                📦 Public Repositories
                {repositories.length > 0 && (
                  <span className="repo-count">({repositories.length} shown)</span>
                )}
              </h3>
              {loadingRepos && (
                <div className="repo-loading">
                  <span className="loading-dots">Loading repositories...</span>
                </div>
              )}
            </div>

            {!loadingRepos && repositories.length > 0 && (
              <div className="repositories-grid">
                {repositories.map((repo) => (
                  <div key={repo.id} className="repository-card">
                    <div className="repo-header">
                      <a
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="repo-name"
                      >
                        {repo.name}
                      </a>
                      {repo.homepage && (
                        <a
                          href={repo.homepage.startsWith('http') ? repo.homepage : `https://${repo.homepage}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="repo-homepage"
                          title="Visit homepage"
                        >
                          🔗
                        </a>
                      )}
                    </div>

                    {repo.description && (
                      <p className="repo-description">{repo.description}</p>
                    )}

                    <div className="repo-stats">
                      {repo.language && (
                        <div className="repo-language">
                          <span 
                            className="language-dot" 
                            style={{ backgroundColor: getLanguageColor(repo.language) }}
                          ></span>
                          <span className="language-name">{repo.language}</span>
                        </div>
                      )}

                      <div className="repo-metrics">
                        {repo.stargazers_count > 0 && (
                          <span className="metric">
                            ⭐ {formatNumber(repo.stargazers_count)}
                          </span>
                        )}
                        {repo.forks_count > 0 && (
                          <span className="metric">
                            🍴 {formatNumber(repo.forks_count)}
                          </span>
                        )}
                      </div>
                    </div>

                    {repo.topics && repo.topics.length > 0 && (
                      <div className="repo-topics">
                        {repo.topics.slice(0, 3).map((topic, index) => (
                          <span key={index} className="topic-tag">
                            {topic}
                          </span>
                        ))}
                        {repo.topics.length > 3 && (
                          <span className="topic-more">+{repo.topics.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="repo-updated">
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingRepos && repositories.length === 0 && public_repos > 0 && (
              <div className="no-repos-message">
                <p>No public repositories found or failed to load repositories.</p>
                <a
                  href={`https://github.com/${login}?tab=repositories`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-all-repos"
                >
                  View all repositories on GitHub →
                </a>
              </div>
            )}

            {repositories.length > 0 && public_repos > repositories.length && (
              <div className="view-more-repos">
                <a
                  href={`https://github.com/${login}?tab=repositories`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-all-repos"
                >
                  View all {public_repos} repositories on GitHub →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    );
}