import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import LatestNews from '../latestNews/LatestNews';

class MainContent extends Component {

  getView = () => {
    switch(this.props.currentView) {
      case "Home":
        return <div className="mainContainer"><LatestNews /></div>
      case "Partie":
        return <div className="mainContainerParties"><PartieInformation /></div>
      default:
        return <div className="mainContainer"><LatestNews /></div>
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
    currentView: state.view.currentView
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
