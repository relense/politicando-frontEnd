import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import PartyCouncilman from '../partyCouncilman/PartyCouncilman';
import LatestNews from '../latestNews/LatestNews';
import { asyncCloseDrawer } from '../../actions/viewActions';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

class MainContent extends Component {
  getView = () => {
    switch(this.props.currentView) {
      case "HOME":
        return (this.setView(<LatestNews articles={this.props.articles} />, true));

      case "PARTIES":
          if (this.props.partyView === "NOTICIAS") 
            return (this.setView(<PartieInformation />));
          else 
            return (this.setView(<PartyCouncilman />));
          
      case "ABOUT":
          return (this.setView());

      default:
        return (this.setView(<LatestNews articles={this.props.articles} />, true));
    }
  }

  setView = (component = null, adjust = false) => {
      return (
        <div className={(this.props.drawer ? 'mainContainerDark' : '') + checkDarkModeBackground(this.props.darkMode)} onClick={() => this.props.closeDrawer()}>
          {adjust && <div className="spacingAdjustment"></div>}
          <div className={this.props.drawer ? 'removeLinks' : ''}>
            {component}
          </div>
        </div>
      )
  }

  render() {
    return (this.getView());
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    articles: state.articles.all_articles,
    partyView: state.view.partyView,
    drawer: state.view.drawer,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
