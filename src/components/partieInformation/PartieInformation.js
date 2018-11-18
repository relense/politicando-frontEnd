import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartieInformation.css';
import { asyncGetPartieNews } from '../../actions/partiesActions.js';
import LatestNews from '../latestNews/LatestNews.js';
import PartyHeader from '../partyHeader/PartyHeader.js';

class PartieInformation extends Component {

  componentWillMount() {
    this.props.getPartieNews(this.props.currentPartie.id)
  }

  render() {
    let condition = this.props.partieNews !== null ? this.props.currentPartie.party_name !== undefined : false;
    let articles = condition ? <LatestNews articles={this.props.partieNews} /> : <LatestNews articles={this.props.articles} />;

    return (
      <div className="partieInformationMainContainer">
        <PartyHeader />
        <div>
          {articles}
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews,
    articles: state.articles.all_articles,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartieInformation);
