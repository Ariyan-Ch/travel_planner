
import './App.css'
import Map from './components/Map'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { getTouristPlace, getWikiSummary } from './utils/wiki';
import polyline from '@mapbox/polyline';

const baseUrl = import.meta.env.VITE_SERVICE_URL

const querySubmission = async ({query, model}) =>{

  //console.log(baseUrl)
  const response = await axios.get(`${baseUrl}/getmap`, {params: { query, model }}) // Adjust API path
  if (response.data == {})
    response.data.response = "Query is invalid or couldn't be parsed correctly."
  else
    response.data.response = "Query is valid."
  return response.data
} 


function App() {
  

  const [query, setQuery] = useState('')
  const [model, setModel] = useState('gemini')
  const [routePoints, setRoutePoints] = useState([]);
  const [stops, setStops] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: querySubmission,
    onSuccess: async (data) => {
      if (data.response === "Query is valid.") {

        try {

          // CODE HERE
          const { start, end, start_lat, start_lon, end_lat, end_lon, sample_points } = data;
                    // Collect tourist stops
          const stops = [];
          const selectedTitles = new Set();
          for (const [point, cum_dist] of sample_points) {
            const [lat, lon] = point;
            const place = await getTouristPlace(lat, lon);
            if (place && !selectedTitles.has(place.title)) {
              stops.push({
                title: place.title,
                lat: place.lat,
                lon: place.lon,
                cum_dist
              });
              selectedTitles.add(place.title);
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Polite delay
          }

          // Sort stops by distance
          stops.sort((a, b) => a.cum_dist - b.cum_dist);

          // Construct waypoints for OSRM
          const waypoints = [
            [start_lon, start_lat],
            ...stops.map(stop => [stop.lon, stop.lat]),
            [end_lon, end_lat]
          ];
          const waypointsStr = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');

          // Get route through waypoints
          const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${waypointsStr}?steps=true&geometries=polyline&overview=full`;
          const response = await axios.get(osrmUrl, { timeout: 10000 });
          const routeData = response.data;
          if (routeData.code !== 'Ok' || !routeData.routes) {
            throw new Error("No route found by OSRM with waypoints");
          }

          // Extract route data
          const routeGeometry = routeData.routes[0].geometry;
          const legs = routeData.routes[0].legs;

          // Decode polyline for map
          const points = polyline.decode(routeGeometry);

          // Add summaries to stops
          for (const stop of stops) {
            stop.extract = await getWikiSummary(stop.title);
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Function to convert OSRM step to bullet
          const stepToBullet = (step) => {
            const maneuver = step.maneuver;
            const mType = maneuver.type;
            const modifier = maneuver.modifier || '';
            const name = step.name || 'current road';
            if (mType === 'depart') return null;
            if (mType === 'arrive') return null;
            if (name === "current road") return null;
            if (['turn', 'exit', 'on ramp', 'off ramp', 'roundabout'].includes(mType)) {
              return `${mType.charAt(0).toUpperCase() + mType.slice(1)} ${modifier} onto ${name}`.trim();
            }
            return null;
          };

          // Generate itinerary
          const itinerary = [`Start from ${start}`];
          for (let i = 0; i < legs.length; i++) {
            for (const step of legs[i].steps) {
              const bullet = stepToBullet(step);
              if (bullet && itinerary[itinerary.length - 1] !== bullet) {
                itinerary.push(bullet);
              }
            }
            if (i < stops.length) {
              const stop = stops[i];
              itinerary.push(`Stop at ${stop.title}: ${stop.extract}`);
            }
          }
          itinerary.push(`Arrive at ${end}`);

          // Set state for map and itinerary
          setRoutePoints(points);
          setStops(stops);
          setItinerary(itinerary);
          setError('');          
          
        }
        catch (error){
          setError(`Error processing route: ${error.message}`)
          console.error(error)
        }
      }
    }, 
  })

  const handleSubmit = () => {

    // “reset” the UI immediately
    setRoutePoints([]);
    setStops([]);
    setItinerary([]);
    setError('');
    mutation.mutate({query,model})

  }

  return (
    <div className='w-screen p-4 md:px-8 lg:px-16 xl:px-32 2xl:px-64 flex flex-col'>
      {/* title */}
      <p className="mb-2 p-2 text-xs md:text-lg xl:text-2xl flex justify-left font-bold text-black bg-gray-200 w-full rounded-xl">
        Generate Travel Suggestions!
      </p>

      <div className='bg-gray-200 w-full min-h-screen flex items-start flex-col md:flex-row justify-center md:justify-between border-2 border-gray-300 rounded-2xl '> 

        {/* Input Area */}
        <div className='m-2 border-2 flex flex-col border-gray-300 rounded-lg w-full text-start bg-gray-100'> 
          <div className='p-2 mr-2'>
            <p className='font-bold text-xs text-gray-600'>Travel Query</p>

            <textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className='bg-white mx-1 mt-2 p-2 border-2 min-h-[100px] w-full border-gray-300 rounded-lg shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] text-sm'
              placeholder='Enter your plan.'> 
            </textarea>
            <div className="flex justify-end">
              <button onClick={handleSubmit} className='bg-blue-400 my-2 px-4 py-1 border-[1px] border-black rounded-2xl shadow-lg cursor-pointer text-white'>
                Submit
              </button>
            </div>
          </div>
            
          <div className='border-y-2 border-gray-300 p-2'>
            <p className='font-bold text-xs text-gray-600'>Model Selection</p>
            <div className="flex mt-2">
              {/* Option 1 */}
              <label className="flex items-center space-x-2 px-4 py-2 border-2 border-gray-200 rounded-lg shadow-sm cursor-pointer bg-white mr-2">
                <input type="radio" name="model" className="accent-purple-600" defaultChecked onChange={() => setModel('t-5')} />
                <span className="text-sm">T-5</span>
              </label>

              {/* Option 2 */}
              <label className="flex items-center space-x-2 px-4 py-2 border-2 border-gray-200 rounded-lg shadow-sm cursor-pointer bg-white">
                <input type="radio" name="model" className="accent-purple-600" onChange={() => setModel('gemini')}/>
                <span className="text-sm">Gemini</span>
              </label>
            </div>

          </div>

          <div className='p-2 mr-2'>
            <p className='font-bold text-xs text-gray-600'>Feedback</p>
            <div className='bg-white mx-1 mt-2 p-2 border-2  w-full border-gray-300 rounded-lg shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] text-sm'>
              {mutation.isPending ? (
                <p className='text-gray-700 italic'>Processing the Query...</p>
              ) : mutation.isError ? (
                <p className='text-red-700 bold'>Error: {mutation.error.message}</p>
              ) : mutation.isSuccess ? (
                <p className='text-green-700'>{mutation.data.response}</p>
              ) : (
                <p className='text-gray-400 italic'>Awaiting query...</p>
              )}
              {error && <p className='text-red-700 bold'>{error}</p>}
            </div>
          </div>
          
        </div>



        {/* Output & Map */}
        <div className='m-2 border-2 border-gray-300 rounded-lg w-full bg-gray-100'> 
        
          {/* MAP */}
          <Map
            routePoints={routePoints}
            stops={stops}
            start={{ lat: mutation.data?.start_lat, lon: mutation.data?.start_lon, name: mutation.data?.start }}
            end={{ lat: mutation.data?.end_lat, lon: mutation.data?.end_lon, name: mutation.data?.end }}
          />

          {/* Iterary Suggestions */}
          <div className='m-2 p-2 border-2 border-gray-300 text-left rounded-lg text-black bg-white'>
            <p className='font-bold text-xs'>Itinerary suggestion</p>
            <div className='mx-1 mt-2 p-2 border-2 border-gray-300 text-left rounded-lg shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] font-base  max-h-[300px] overflow-y-auto'>

                {itinerary.map((line, index) => (
                  <p key={index}>- {line}</p>
                ))}

              {/* <p>- This is the first paragraph.</p>
              <p>- This is the second paragraph.</p>
              <p>- This is the first paragraph.</p>
              <p>- This is the second paragraph.</p> */}
            </div>
          </div>

        </div>


      </div>


    </div>
  )
}

export default App
