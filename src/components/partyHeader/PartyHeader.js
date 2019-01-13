import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import './PartyHeader.css';
import { asyncChangePartyView } from '../../redux/actions/viewActions.js';

class PartyHeader extends Component {

  renderLogo = () => {
    let imageName = "";

    let partieLogo = {
        maxWidth: '200px',
        maxHeight: '70px'
    }

    switch(this.props.currentPartie.party_name) {
      case "PS":
        imageName = "ps_logo.png";
        break;
      case "PSD":
        imageName = "psd_logo.png";
        break;
      case "BE":
        imageName = "be_logo.png";
        break;
      case "CDS-PP":
        imageName = "cds_logo.png";
        break;
      case "PCP":
        imageName = "pcp_logo.png";
        break;
      case "PEV":
        imageName = "pev_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '100px'
        }
        break;
      case "PAN":
        imageName = "pan_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '100px'
        }
        break;
      case "JPP":
        imageName = "jpp_logo.png";
        break;
      case "PPM":
        imageName = "ppm_logo.png";
        break;
      case "PTP":
        imageName = "ptp_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '100px'
        }
        break;
      case "MPT":
        imageName = "mpt_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '100px'
        }
        break;
      case "PDR":
        imageName = "pdr_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '100px'
        }
        break;
      case "L":
        imageName = "l_logo.png";
        break;
      case "NC":
        imageName = "nc_logo.png";
        partieLogo = {
          maxWidth: '200px',
          maxHeight: '90px'
        }
        break;
      default:
        imageName= "ps_logo.png"
    }

    return (
      <div className="partyHeaderLogoContainer">
        <img src={ require(`../../images/${imageName}`)} style={partieLogo} alt={this.props.currentPartie.description} />
      </div>
    );
  }
  
  checkDarkMode(partyView){
    let classNameString = "";
    let selected = "";
    let notSelected = "";

    if(this.props.darkMode) {
      selected = 'buttonsSelectedDarkMode';
      notSelected = 'buttonsDarkMode';
    } else {
      selected = 'buttonsSelectedLightMode';
      notSelected = 'buttonsLightMode';
    }

    if(this.props.partyView === partyView)
      classNameString = selected + ' partieElems';    
    else 
      classNameString = notSelected + ' partieElems';
    
    return classNameString;
  }

  render() {
    let condition = this.props.partieNews !== null ? this.props.currentPartie.party_name !== undefined : false;
    let logo = condition ? this.renderLogo() : "";

    return (
        <div className="partieHeaderContent">
        {condition &&
          <Fragment>
            {logo}
          </Fragment>
        }
        </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie,
    partyView: state.view.partyView,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setPartyView: (view) => {
      dispatch(asyncChangePartyView(view))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartyHeader);
