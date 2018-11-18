import React, { Component } from 'react';
import { connect } from 'react-redux';
import Header from './components/header/Header.js';
import MainContent from './components/mainContent/MainContent.js';
import { loadParties, loadNextTenPartyArticles } from './actions/partiesActions';
import { loadArticles, loadNextTenArticles } from './actions/articlesActions';

import './App.css';

class App extends Component {
  constructor(props){
    super(props);
    this.state=({
      scroll: false
    })
  }

  componentWillMount() {
    this.props.fetchParties();
    this.props.fetchArticles();
  }

  componentDidMount() {
    window.addEventListener('scroll', (event) => {
      this.handleScroll(event);
      this.handleScrollMainContent(event, this.props.articles, this.props.fetchNextTenParties)
      this.handleScrollPartieInfo(event, this.props.currentPartie, this.props.partieNews, this.props.getNextTenPartieNews)
    });
  }

  handleScrollMainContent = (event, articles, fetchTen) => {
    if (this.props.currentView === 'HOME') {
      if (document.documentElement.scrollTop + window.innerHeight === document.documentElement.scrollHeight) {
        fetchTen(articles[articles.length - 1].id)
      }
    }
  }

  handleScroll = (event) => {
    if (window.scrollY === 0 && this.state.scroll === true) {
        this.setState({scroll: false});
    } else if (window.scrollY !== 0 && this.state.scroll !== true) {
        this.setState({scroll: true});
    }
  }

  handleScrollPartieInfo = (event, party, articles, fetchTen) => {
    if (party !== null && articles !== null && articles.length > 0 && this.props.currentPartie && this.props.currentView === 'PARTIES') {
      if (document.documentElement.scrollTop + window.innerHeight === document.documentElement.scrollHeight) {
        fetchTen(party.id, articles[articles.length - 1].id)
      }
    }
  }

  render() {
    return (
      <div style={{width: '100%', height: '100%'}}>
        <Header scroll={this.state.scroll} />
        <div className={this.state.scroll ? 'adjustContent' : ''}>
          <MainContent/>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews,
    articles: state.articles.all_articles
  }
}

function mapDispatchToProps(dispatch) {
  return {
    fetchParties: () => {
      dispatch(loadParties())
    },
    fetchArticles: () => {
        dispatch(loadArticles())
    },
    fetchNextTenParties: (article_id) => {
      dispatch(loadNextTenArticles(article_id))
    },
    getNextTenPartieNews: (party_id, article_id) => {
      dispatch(loadNextTenPartyArticles(party_id, article_id))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
