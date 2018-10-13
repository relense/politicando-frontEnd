import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import List from '../list/List.js';
import PartieInformation from '../partieInformation/PartieInformation'

class MainContent extends Component {

  getHome = () =>  {
    return (
        <div className="mainChild">
          <h3>Últimas informações</h3>
        </div>
      );
  }

  getPartieContent = () => {
    return <PartieInformation />
  }

  getView = () => {
    switch(this.props.currentView) {
      case "Home":
        return this.getHome();
      case "Partie":
        return this.getPartieContent();
      default:
        return this.getHome();
    }
  }

  render() {
    return (
      <div className="mainContainer">
        <div className="smallChild">
          <List />
        </div>
        <div className="contentContainer">
          { this.getView() }
        </div>
      </div>
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
