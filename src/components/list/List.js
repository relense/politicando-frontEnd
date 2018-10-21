import { connect } from 'react-redux';
import { asyncChangeCurrentPartie } from '../../actions/partiesActions';
import { asyncChangeView } from '../../actions/viewActions';
import React from 'react';
import './List.css';


class List extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      index: null
    };
  }

  selectPartie = (i) => {
    this.props.changeView("Partie");
    this.props.changeCurrentPartie(this.props.parties[i]);

    this.setState({
      open: this.state.open ? ((this.state.index === i) ? false : true) : true,
      index: i
    })
  }

  renderData = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {

        let title = this.props.parties[i].description + ": " + this.props.parties[i].deputies_republic_chamber + " - Assembleia da República";
        data.push(
            <div key={i} className="partieNameContainer" title={title} onClick={() => this.selectPartie(i)}>
                { this.props.parties[i].party_name } - {this.props.parties[i].deputies_republic_chamber}
            </div>
        );
      }
    }

    return data;
  }

  renderOpenData = (j) => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {

        let title = this.props.parties[i].description + ": " + this.props.parties[i].deputies_republic_chamber + " - Assembleia da República";
        if(j === i) {
          data.push(
              <div key={i} className="partieNameContainerSelected" title={title}>
                <div className="partieTitle" onClick={() => this.selectPartie(i)}>
                  { this.props.parties[i].party_name } - {this.props.parties[i].deputies_republic_chamber}
                </div>
                <div className="partieChildContainer">
                  <div className="partieItem">Basic Information</div>
                  <div className="partieItem">Seats in Government</div>
                  <div className="partieItem">News</div>
                </div>
              </div>
          );
        } else {
          data.push(
              <div key={i} className="partieNameContainer" title={title} onClick={() => this.selectPartie(i)}>
                  { this.props.parties[i].party_name } - {this.props.parties[i].deputies_republic_chamber}
              </div>
          );
        }
      }
    }

    return data;
  }

  renderContent = () => {
    if(!this.state.open) {
      return this.renderData();
    } else {
      return this.renderOpenData(this.state.index);
    }
  }

  render() {
    return (
      <div className="mainContainter">
        { this.renderContent() }
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(List);
