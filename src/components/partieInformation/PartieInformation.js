import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartieInformation.css';
import Subject from '@material-ui/icons/Subject';
import HowToVote from '@material-ui/icons/HowToVote';
import EventSeat from '@material-ui/icons/EventSeat'

const optionElem = {
    width: '40px',
    height: '40px',
    color: 'white'
}

class PartieInformation extends Component {
  render() {
    return (
      <div className="partieInformationMainContainer">
        <div className="partieInformationContent">
          <img src={ require('../../images/ps_logo.png')} className="partieLogo" alt={this.props.currentPartie.description} />
          <h3 className="partieTitle">{this.props.currentPartie.party_name} : {this.props.currentPartie.description}</h3>
        </div>
        <div className="parentOptionContainer">
          <div className="optionsContainer" style={{ backgroundColor: '#5EC58B'}}>
            <div className="optionsTitleContainer">
              <Subject style={optionElem} />
              <h3 className="optionsCardTitle" >Basic Information</h3>
            </div>
          </div>
          <div className="smallContainer">
            <div className="doubleOptionContainer">
              <div className="optionsContainer" style={{ backgroundColor: '#FFC07A'}}>
                <div className="optionsTitleContainer">
                  <HowToVote style={optionElem} />
                  <h3 className="optionsCardTitle">Votes</h3>
                </div>
              </div>
              <div className="optionsContainer" style={{ backgroundColor: '#FFB09B'}}>
                <div className="optionsTitleContainer">
                  <EventSeat style={optionElem} />
                  <h3 className="optionsCardTitle">Lugares no Governo</h3>
                </div>
              </div>
            </div>
            <div className="doubleOptionContainer">
              <div className="optionsContainer" style={{ backgroundColor: '#5A99B4'}}>
                <div className="optionsTitleContainer">
                  <EventSeat style={optionElem} />
                </div>
              </div>
            </div>
          </div>
        </div>
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
