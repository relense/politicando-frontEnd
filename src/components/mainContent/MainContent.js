import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import PartyCouncilman from '../partyCouncilman/PartyCouncilman';
import LatestNews from '../latestNews/LatestNews';

class MainContent extends Component {
  getView = () => {
    switch(this.props.currentView) {
      case "HOME":
        return (
          <div className="mainContainer">
            <div className="spacingAdjustment"></div>
            <LatestNews articles={this.props.articles} />
          </div>
        )

      case "PARTIES":
          if (this.props.partyView === "NOTICIAS") {
            return (
              <div className="mainContainer">
                <PartieInformation />
              </div>
            )
          } else {
            return (
              <div className="mainContainer">
                <PartyCouncilman />
              </div>
            )
          }
      case "ABOUT":
          return (
            <div className="mainContainer">
            </div>
          )
      default:
        return (
          <div className="mainContainer">
            <div className="spacingAdjustment"></div>
            <LatestNews articles={this.props.articles} />
          </div>
        )
    }
  }

  render() {
    return (
        this.getView()
    );
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    articles: state.articles.all_articles,
    partyView: state.view.partyView
  };
}

function mapDispatchToProps(dispatch) {
  return { }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
