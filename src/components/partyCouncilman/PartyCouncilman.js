import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartyCouncilman.css';
import PartyHeader from '../partyHeader/PartyHeader.js';

class PartyCouncilman extends Component {
  render() {
    return (
      <div className={this.props.darkMode ? "partieCouncilmenInformationMainContainerDarkMode" : "partieCouncilmenInformationMainContainer"}>
        <PartyHeader />
        <div>

        </div>
      </div>
  
    );
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartyCouncilman);