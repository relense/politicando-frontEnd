import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import './PartyHeader.css';
import { asyncChangePartyView } from '../../actions/viewActions.js';

class PartyHeader extends Component {

  renderLogo = () => {
    let imageName = "";

    const partieLogo = {
        maxWidth: '200px',
        maxHeight: '50px'
    }

    switch(this.props.currentPartie.party_name) {
      case "PS":
        imageName = "ps_logo.png";
        break;
      case "PSD":
        imageName = "psd_logo.jpeg";
        break;
      case "BE":
        imageName = "be_logo.jpg";
        break;
      case "CDS":
        imageName = "cds-pp_logo.png";
        break;
      case "PCP":
        imageName = "pcp_logo.png";
        break;
      case "PEV":
        imageName = "pev_logo.gif";
        break;
      case "PAN":
        imageName = "pan_logo.jpeg";
        break;
      case "JPP":
        imageName = "jpp_logo.png";
        break;
      case "PPM":
        imageName = "ppm_logo.jpeg";
        break;
      case "PTP":
        imageName = "ptp_logo.jpg";
        break;
      case "MPT":
        imageName = "mpt_logo.jpg";
        break;
      case "PDR":
        imageName = "pdr_logo.png";
        break;
      case "L":
        imageName = "l_logo.png";
        break;
      case "NC":
        imageName = "nc_logo.jpeg";
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

  render() {
    let condition = this.props.partieNews !== null ? this.props.currentPartie.party_name !== undefined : false;
    let logo = condition ? this.renderLogo() : "";

    return (
        <div className="partieHeaderContent">
        {condition &&
          <Fragment>
            <div className={this.props.partyView === "NOTICIAS" ? 'partieElemsSelected' : 'partieElems'} onClick={() => this.props.setPartyView("NOTICIAS")}>
              Notícias
            </div>
            {logo}
            <div className={this.props.partyView === "DEPUTADOS" ? 'partieElemsSelected' : 'partieElems'} onClick={() => this.props.setPartyView("DEPUTADOS")}>
              Deputados
            </div>
          </Fragment>
        }
        </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie,
    partyView: state.view.partyView
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
