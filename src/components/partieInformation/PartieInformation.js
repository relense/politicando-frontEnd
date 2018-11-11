import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartieInformation.css';
import { asyncGetPartieNews } from '../../actions/partiesActions.js';
import LatestNews from '../latestNews/LatestNews';

class PartieInformation extends Component {

  componentWillMount() {
    this.props.getPartieNews(this.props.currentPartie.id)
  }

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
      case "CDS-PP":
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

    return <img src={ require(`../../images/${imageName}`)} style={partieLogo} alt={this.props.currentPartie.description} />
  }

  render() {
    return (
      <div className="partieInformationMainContainer">
        <div className="partieInformationContent">
          {this.renderLogo()}
          <h3 className="partieTitle">
            {this.props.currentPartie.party_name} : {this.props.currentPartie.description}
          </h3>
          <h3 className="partieTitle partieTitleLast">
            {this.props.partieNews ? this.props.partieNews.length + " Notícias" : ""}
          </h3>
        </div>
        <div>
          {this.props.partieNews &&
            <LatestNews articles={this.props.partieNews} />
          }
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie,
    partieNews: state.parties.partieNews
  };
}

function mapDispatchToProps(dispatch) {
  return {
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    }
   };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartieInformation);
