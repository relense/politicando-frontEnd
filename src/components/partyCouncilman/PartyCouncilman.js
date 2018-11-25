import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartyCouncilman.css';
import PartyHeader from '../partyHeader/PartyHeader.js';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

class PartyCouncilman extends Component {
  render() {
    return (
      <div className={'partieCouncilmenInformationMainContainer' + checkDarkModeBackground(this.props.darkMode)}>
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