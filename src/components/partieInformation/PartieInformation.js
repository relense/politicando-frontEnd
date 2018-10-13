import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartieInformation.css';

class PartieInformation extends Component {
  render() {
    return (
      <div className="mainChild">
          <h3>{this.props.currentPartie.party_name} - {this.props.currentPartie.description}</h3>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartieInformation);
