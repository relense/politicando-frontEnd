import React, { Component } from 'react';
import moment from 'moment'
import './LatestNews.css';

class LatestNewsSingleContainer extends Component {
  render() {
    return (
      <div className="latestNewsSingleContainer">
        <h1 className="lastestNewsSingleContainerTitle selectForbiden">{this.props.article.title}</h1>
        <div className="latestNewsContentContainer">
          {this.props.article.image_url &&
            <img src={this.props.article.image_url} className="newsImage" alt="example pic" />

          }
          <div className="blur selectForbiden">
            {this.props.article.content}
            <div className="fadeout"></div>
          </div>
        </div>
        <div className="latestNewsDiscussionContainer">
          {moment(this.props.article.published_time).format('MM-DD-YYYY | HH:mm')} | {this.props.article.source}
          <div className="latestNewsDiscussionContainerLinkContainer">
            <a href={this.props.article.news_url} className="latestNewsDiscussionContainerLink" target="_blank" rel="noopener noreferrer">
              Visitar notícia
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default LatestNewsSingleContainer;
