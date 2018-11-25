import React, { Component } from 'react';
import { connect } from 'react-redux';
import Header from './components/header/Header.js';
import MainContent from './components/mainContent/MainContent.js';
import MenuBoard from './components/menuBoard/MenuBoard.js';
import { loadParties, loadNextTenPartyArticles } from './actions/partiesActions.js';
import { loadArticles, loadNextTenArticles } from './actions/articlesActions.js';
import './App.css';
import './utils/Colors.css';

class App extends Component {
  constructor(props){
    super(props);
    this.state=({
      scroll: false
    })
  }

  UNSAFE_componentWillMount() {
    this.props.fetchParties();
    this.props.fetchArticles();
  }

  componentDidMount(e) {
    window.addEventListener('scroll', (e) => {
      this.handleScroll();
      this.handleScrollMainContent(e, this.props.articles, this.props.fetchNextTenArticles)
      this.handleScrollPartieInfo(e, this.props.currentPartie, this.props.partieNews, this.props.getNextTenPartieNews)
    }, true);
  }

  handleScrollMainContent = (e, articles, fetchTen) => {
    if (this.props.currentView === 'HOME' && this.props.drawer === false) {
      if (e.target.documentElement.scrollHeight - Math.round(e.target.documentElement.scrollTop) === e.target.documentElement.clientHeight 
        || e.target.documentElement.scrollHeight - Math.floor(e.target.documentElement.scrollTop) === e.target.documentElement.clientHeight) {
        fetchTen(articles[articles.length - 1].id)
      }
    }
  }

  handleScroll = () => {
    if (window.scrollY === 0 && this.state.scroll === true) {
        this.setState({scroll: false});
    } else if (window.scrollY !== 0 && this.state.scroll !== true) {
        this.setState({scroll: true});
    }
  }

  handleScrollPartieInfo = (e, party, articles, fetchTen) => {
    if (party !== null && articles !== null && articles.length > 0 && this.props.currentPartie !== "" && this.props.currentView === 'PARTIES' && this.props.drawer === false) {
      if (e.target.documentElement.scrollHeight - Math.round(e.target.documentElement.scrollTop) === e.target.documentElement.clientHeight
        || e.target.documentElement.scrollHeight - Math.floor(e.target.documentElement.scrollTop) === e.target.documentElement.clientHeight) {
        fetchTen(party.id, articles[articles.length - 1].id)
      }
    }
  }

  render() {
    return (
      <div className="appMainContent">
        <Header scroll={this.state.scroll} />
        <div className={this.state.scroll ? 'adjustContentDrawer' : ''}>
          {this.props.drawer && <MenuBoard  scroll={this.state.scroll}/> }
        </div>
          <MainContent onScroll={this.handleContentScroll}/>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews,
    articles: state.articles.all_articles,
    drawer: state.view.drawer
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
    fetchNextTenArticles: (article_id) => {
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
