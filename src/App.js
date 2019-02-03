import React, { Component } from 'react';
import { connect } from 'react-redux';
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import ReactGA from 'react-ga';
import Header from './components/header/Header.js';
import MainContent from './components/mainContent/MainContent.js';
import PartiesContent from './components/partiesContent/PartiesContent.js'
import MenuBoard from './components/menuBoard/MenuBoard.js';
import ArticleDiscussion from './components/articleDiscussion/ArticleDiscussion.js';
import { loadParties, loadNextTenPartyArticles } from './redux/actions/partiesActions.js';
import { loadArticles, loadNextTenArticles } from './redux/actions/articlesActions.js';
import { setDarkMode } from './redux/actions/viewActions.js';
import { Helmet } from "react-helmet";
import './App.css';
import './utils/Colors.css';

const Home = () => <MainContent />
const Article = ({match}) => <ArticleDiscussion id={match.params.id}/>;
const Partie = ({match}) => <PartiesContent name={match.params.name} />

class App extends Component {
  constructor(props){
    super(props);
    this.state=({
      scroll: false,
    })

    ReactGA.initialize('UA-133652354-1');
    ReactGA.pageview(window.location.pathname);
  }

  componentWillMount(){
    this.props.fetchParties();
    this.props.fetchArticles();
  }

  componentDidMount() {
    this.props.setUpDarkMode(localStorage['darkMode'] || 'false');
    
    document.addEventListener('scroll', () => {
      this.handleScroll();
      this.handleScrollMainContent(this.props.articles, this.props.fetchNextTenArticles)
      this.handleScrollPartieInfo(this.props.currentPartie, this.props.partieNews, this.props.getNextTenPartieNews)
    }, true);
  }

  handleScrollMainContent = (articles, fetchTen) => {
    let scrollTop = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop)

    if (this.props.moreNewsAll && this.props.loading === false && this.props.currentView === 'HOME' && this.props.drawer === false) {
      if (Math.round(document.documentElement.scrollHeight - scrollTop) <= document.documentElement.clientHeight
        || Math.round(document.documentElement.scrollHeight - scrollTop) <= document.documentElement.clientHeight + 100) {
        fetchTen(articles[articles.length - 1].id);
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

  handleScrollPartieInfo = (party, articles, fetchTen) => {
    let scrollTop = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop)

    if (this.props.moreNewsParties && this.props.partieLoading === false && party !== null && articles !== null && articles.length > 0 && this.props.currentPartie !== "" && this.props.currentView === 'PARTIES' && this.props.drawer === false) {
      if (Math.round(document.documentElement.scrollHeight - scrollTop) <= document.documentElement.clientHeight
        || Math.round(document.documentElement.scrollHeight - scrollTop) <= document.documentElement.clientHeight + 100) {
        fetchTen(party.id, articles[articles.length - 1].id)
      }
    }
  }

  render() {
    return (
      <div>
        <Helmet>
          <meta name="description" content="Politicando, para encontrar as notíticas sobre os partidos politícos em portugal. Noticias divididas por partido politico. Politica em Portugal." />
        </Helmet>
        <Router>
          <div className="mainApp">
              <Header scroll={this.state.scroll} />
              <div className={this.state.scroll ? 'adjustContentDrawer' : ''}>
                {this.props.drawer && <MenuBoard scroll={this.state.scroll}/>}
              </div>
              <Switch>
                <Route exact path={"/"} component={Home} />
                <Route path={"/article/:id"} component={Article} />
                <Route path={"/partido/:name"} component={Partie} />}
              </Switch>
          </div>
        </Router>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews,
    articles: state.articles.allArticles,
    drawer: state.view.drawer,
    currentArticle: state.articles.currentArticle,
    loading: state.articles.loading,
    partieLoading: state.parties.partieLoading,
    moreNewsParties: state.parties.moreNews,
    moreNewsAll: state.articles.moreNews
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
    },
    setUpDarkMode: (darkMode) => {
      dispatch(setDarkMode(darkMode))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App);
