import React, { Component } from 'react';
import { connect } from 'react-redux';
import './ArticleDiscussion.css';
import { asyncLoadArticle } from '../../actions/articlesActions';
// import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';
import LatestNewsSingleContainer from '../latestNewsSingleContainer/LatestNewsSingleContainer.js';

class ArticleDiscussion extends Component {
  componentDidMount() {
    if(this.props.currentArticle === null) {
      this.props.getArticle(this.props.id)
    }
    window.scrollTo(0, 0)
  }

  setView = () => {
    if(this.props.currentArticle !== null) {
        return <LatestNewsSingleContainer  article={this.props.currentArticle}/>
    } else {
        return <LatestNewsSingleContainer />
    }
  }

  render() {
    return (
      <div className="articleDiscussionMainContainer">
        <div className={'articleContainer'}>
          {this.setView()}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.articles.currentArticle,
    articleLoaded: state.articles.articleLoaded
  };
}

function mapDispatchToProps(dispatch) {
  return {     
    getArticle: (article_id) => {
      dispatch(asyncLoadArticle(article_id))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ArticleDiscussion);
