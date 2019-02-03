import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartieInformation.css';
import LatestNews from '../latestNews/LatestNews.js';
import PartyHeader from '../partyHeader/PartyHeader.js';
import { asyncChangeView } from '../../redux/actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../redux/actions/partiesActions';
import { asyncLoadArticle } from '../../redux/actions/articleActions';

class PartieInformation extends Component {

  componentWillMount() {
    this.props.getPartieNews(this.props.currentPartie.id);
  }

  checkDarkMode(){
    if(this.props.darkMode) 
      return 'backgroundDarkMode';
    else 
      return 'backgroundLightMode';
  }

  render() {
    let condition = this.props.partieNews !== null ? this.props.currentPartie.party_name !== undefined : false;
    let articles = condition ? <LatestNews articles={this.props.partieNews} /> : <LatestNews articles={this.props.articles} />;

    return (
      <div className={'partieInformationMainContainer ' + this.checkDarkMode()}>
        {condition && <PartyHeader />}
        {articles}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews,
    articles: state.articles.allArticles,
    darkMode: state.view.darkMode,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    },
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    getArticle: (article_id) => {
      dispatch(asyncLoadArticle(article_id))
    },
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartieInformation);
