import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import LatestNews from '../latestNews/LatestNews';

class MainContent extends Component {

  getView = () => {
    switch(this.props.currentView) {
      case "Home":
        return (
          <div className="mainContainer">
            <div className="spacingAdjustment">
            </div>
            <LatestNews articles={this.props.articles} />
          </div>
        )
      case "Partie":
        return <div className="mainContainerParties"><PartieInformation /></div>
      default:
        return (
          <div className="mainContainer">
            <div className="spacingAdjustment">
            </div>
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
    articles: state.articles.all_articles
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
