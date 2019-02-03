import React, { Component } from 'react';
import { connect } from 'react-redux';
import ReactGA from 'react-ga';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import LatestNews from '../latestNews/LatestNews';
import { asyncCloseDrawer } from '../../redux/actions/viewActions';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

class MainContent extends Component {

  componentDidMount() {
    ReactGA.pageview("/home");
  }

  getView = () => {
    switch(this.props.currentView) {
      case "HOME":
        return (this.setView(<LatestNews articles={this.props.articles} />));

      case "PARTIES":
        return (this.setView(<PartieInformation />));

      default:
        return (this.setView(<LatestNews articles={this.props.articles} />));
    }
  }

  setView = (component = null) => {
    return (
      <div className={(this.props.drawer ? 'mainContainerDark' : '') + checkDarkModeBackground(this.props.darkMode)} onClick={() => this.props.closeDrawer()}>
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
    articles: state.articles.allArticles,
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
